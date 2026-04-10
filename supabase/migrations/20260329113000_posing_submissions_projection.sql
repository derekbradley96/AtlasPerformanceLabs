-- Compatibility table for structured posing submissions.
-- Source of truth remains pose_check_items; this table is synced via trigger.

CREATE TABLE IF NOT EXISTS public.posing_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  checkin_id UUID NOT NULL REFERENCES public.pose_checks(id) ON DELETE CASCADE,
  pose_type TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.posing_submissions
  DROP CONSTRAINT IF EXISTS posing_submissions_pose_type_check;

ALTER TABLE public.posing_submissions
  ADD CONSTRAINT posing_submissions_pose_type_check
  CHECK (
    pose_type IN (
      'quarter_turn_front',
      'quarter_turn_right',
      'quarter_turn_back',
      'quarter_turn_left',
      'front_double_biceps',
      'front_lat_spread',
      'side_chest',
      'side_triceps',
      'rear_double_biceps',
      'rear_lat_spread',
      'abdominals_and_thighs',
      'most_muscular',
      'back_double_biceps',
      'favourite_classic_pose',
      'front_pose',
      'back_pose'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_posing_submissions_checkin_pose_type
  ON public.posing_submissions(checkin_id, pose_type);

CREATE INDEX IF NOT EXISTS idx_posing_submissions_client_created
  ON public.posing_submissions(client_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.sync_posing_submissions_from_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.posing_submissions
    WHERE checkin_id = OLD.pose_check_id
      AND pose_type = OLD.pose_key;
    RETURN OLD;
  END IF;

  IF NEW.photo_path IS NULL OR NEW.photo_path = '' THEN
    DELETE FROM public.posing_submissions
    WHERE checkin_id = NEW.pose_check_id
      AND pose_type = NEW.pose_key;
    RETURN NEW;
  END IF;

  SELECT pc.client_id INTO v_client_id
  FROM public.pose_checks pc
  WHERE pc.id = NEW.pose_check_id;

  IF v_client_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.posing_submissions (
    client_id,
    checkin_id,
    pose_type,
    image_url,
    created_at
  )
  VALUES (
    v_client_id,
    NEW.pose_check_id,
    NEW.pose_key,
    NEW.photo_path,
    now()
  )
  ON CONFLICT (checkin_id, pose_type) DO UPDATE SET
    image_url = EXCLUDED.image_url,
    created_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_posing_submissions_from_items ON public.pose_check_items;
CREATE TRIGGER trg_sync_posing_submissions_from_items
AFTER INSERT OR UPDATE OF photo_path OR DELETE ON public.pose_check_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_posing_submissions_from_items();

ALTER TABLE public.posing_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS posing_submissions_select_coach ON public.posing_submissions;
DROP POLICY IF EXISTS posing_submissions_select_client ON public.posing_submissions;

CREATE POLICY posing_submissions_select_coach ON public.posing_submissions
FOR SELECT USING (
  client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid() OR trainer_id = auth.uid())
);

CREATE POLICY posing_submissions_select_client ON public.posing_submissions
FOR SELECT USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);

COMMENT ON TABLE public.posing_submissions IS 'Projection table for per-pose submissions synced from pose_check_items.';

-- Division key aliases to match product naming:
-- mens_bodybuilding should map to existing mens_open_bodybuilding template.
INSERT INTO public.pose_division_templates (division_key, division_name, category)
VALUES ('mens_bodybuilding', 'Mens Bodybuilding', 'mens')
ON CONFLICT (division_key) DO NOTHING;

INSERT INTO public.pose_template_items (template_id, pose_key, pose_label, pose_group, sort_order, is_mandatory)
SELECT
  alias_t.id,
  src_i.pose_key,
  src_i.pose_label,
  src_i.pose_group,
  src_i.sort_order,
  src_i.is_mandatory
FROM public.pose_division_templates src_t
JOIN public.pose_template_items src_i ON src_i.template_id = src_t.id
JOIN public.pose_division_templates alias_t ON alias_t.division_key = 'mens_bodybuilding'
WHERE src_t.division_key = 'mens_open_bodybuilding'
ON CONFLICT (template_id, pose_key) DO NOTHING;
