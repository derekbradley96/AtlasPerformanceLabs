-- Atlas Pillar Rating System for coach marketplace.
-- NOTE: requested timestamp 20260423270000 is invalid clock time; using valid migration timestamp.

CREATE TABLE IF NOT EXISTS public.coach_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewer_client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  reviewer_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pillars INTEGER NOT NULL CHECK (pillars BETWEEN 1 AND 5),
  review_text TEXT CHECK (char_length(review_text) <= 500),
  tags TEXT[] DEFAULT '{}',
  is_visible BOOLEAN NOT NULL DEFAULT true,
  flagged_at TIMESTAMPTZ,
  flagged_reason TEXT,
  coach_response TEXT CHECK (char_length(coach_response) <= 300),
  coach_responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coach_id, reviewer_client_id)
);

CREATE INDEX IF NOT EXISTS idx_coach_reviews_coach
  ON public.coach_reviews (coach_id)
  WHERE is_visible = true;

CREATE OR REPLACE VIEW public.v_coach_rating_summary AS
SELECT
  coach_id,
  ROUND(AVG(pillars)::numeric, 1) AS avg_pillars,
  COUNT(*)::integer AS review_count,
  COUNT(*) FILTER (WHERE pillars = 5)::integer AS five_pillar_count,
  COUNT(*) FILTER (WHERE pillars = 4)::integer AS four_pillar_count,
  COUNT(*) FILTER (WHERE pillars <= 3)::integer AS three_or_below_count
FROM public.coach_reviews
WHERE is_visible = true
GROUP BY coach_id;

ALTER VIEW public.v_coach_rating_summary SET (security_invoker = on);

ALTER TABLE public.coach_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_reviews_select_all ON public.coach_reviews;
CREATE POLICY coach_reviews_select_all ON public.coach_reviews
  FOR SELECT TO public
  USING (is_visible = true);

DROP POLICY IF EXISTS coach_reviews_insert_client ON public.coach_reviews;
CREATE POLICY coach_reviews_insert_client ON public.coach_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    reviewer_profile_id = (SELECT auth.uid())
    AND reviewer_client_id IN (
      SELECT id
      FROM public.clients
      WHERE user_id = (SELECT auth.uid())
        AND (
          coach_id = coach_reviews.coach_id
          OR trainer_id = coach_reviews.coach_id
        )
    )
  );

DROP POLICY IF EXISTS coach_reviews_update_own ON public.coach_reviews;
CREATE POLICY coach_reviews_update_own ON public.coach_reviews
  FOR UPDATE TO authenticated
  USING (reviewer_profile_id = (SELECT auth.uid()))
  WITH CHECK (reviewer_profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS coach_reviews_coach_response ON public.coach_reviews;
CREATE POLICY coach_reviews_coach_response ON public.coach_reviews
  FOR UPDATE TO authenticated
  USING (coach_id = (SELECT auth.uid()))
  WITH CHECK (coach_id = (SELECT auth.uid()));

ALTER TABLE public.coach_marketplace_profiles
  ADD COLUMN IF NOT EXISTS avg_pillars NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

ALTER TABLE public.marketplace_coach_profiles
  ADD COLUMN IF NOT EXISTS avg_pillars NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION public.refresh_coach_rating_cache(p_coach_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_avg NUMERIC(3,1);
  v_count INTEGER;
  v_prev_count INTEGER;
BEGIN
  SELECT review_count
    INTO v_prev_count
  FROM public.coach_marketplace_profiles
  WHERE coach_id = p_coach_id;

  SELECT ROUND(AVG(pillars)::numeric, 1), COUNT(*)
    INTO v_avg, v_count
  FROM public.coach_reviews
  WHERE coach_id = p_coach_id
    AND is_visible = true;

  UPDATE public.coach_marketplace_profiles
    SET avg_pillars = v_avg, review_count = COALESCE(v_count, 0)
    WHERE coach_id = p_coach_id;

  UPDATE public.marketplace_coach_profiles
    SET avg_pillars = v_avg, review_count = COALESCE(v_count, 0)
    WHERE coach_id = p_coach_id;

  IF COALESCE(v_prev_count, 0) = 0 AND COALESCE(v_count, 0) = 1 THEN
    INSERT INTO public.notifications (profile_id, type, title, message, category, is_read)
    SELECT
      p_coach_id,
      'first_pillar_review',
      'Your first Pillar rating 🏛️',
      (
        SELECT
          'You received ' || r.pillars::text || '/5 Pillars from ' ||
          SPLIT_PART(COALESCE(p.full_name, p.display_name, 'an athlete'), ' ', 1) ||
          '. Check your profile to see what they said.'
        FROM public.coach_reviews r
        JOIN public.profiles p
          ON p.id = r.reviewer_profile_id
        WHERE r.coach_id = p_coach_id
          AND r.is_visible = true
        ORDER BY r.created_at DESC
        LIMIT 1
      ),
      'coaching',
      false
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.profile_id = p_coach_id
        AND n.type = 'first_pillar_review'
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_refresh_coach_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.refresh_coach_rating_cache(COALESCE(NEW.coach_id, OLD.coach_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_coach_review_rating_refresh ON public.coach_reviews;
CREATE TRIGGER trg_coach_review_rating_refresh
  AFTER INSERT OR UPDATE OR DELETE ON public.coach_reviews
  FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_coach_rating();
