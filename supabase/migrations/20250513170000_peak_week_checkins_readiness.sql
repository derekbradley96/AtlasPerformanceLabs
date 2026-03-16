-- Peak week check-ins and stage readiness scoring.
-- Requires: peak_weeks, clients. RLS: coach via clients.coach_id/trainer_id, client via clients.user_id.

-- 1) Table public.peak_week_checkins
CREATE TABLE IF NOT EXISTS public.peak_week_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  peak_week_id UUID NOT NULL REFERENCES public.peak_weeks(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  weight NUMERIC,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  pump_rating INTEGER,
  flat_full_rating INTEGER,
  coach_notes TEXT,
  client_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS peak_week_checkins_client_created_idx
  ON public.peak_week_checkins(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS peak_week_checkins_peak_week_id_idx
  ON public.peak_week_checkins(peak_week_id);

COMMENT ON TABLE public.peak_week_checkins IS 'Peak week–specific check-ins: weight, photos, pump/flat-full ratings, notes.';

-- 2) Table public.stage_readiness_scores
CREATE TABLE IF NOT EXISTS public.stage_readiness_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  peak_week_id UUID REFERENCES public.peak_weeks(id) ON DELETE CASCADE,
  conditioning_score INTEGER,
  fullness_score INTEGER,
  dryness_score INTEGER,
  fatigue_score INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stage_readiness_scores_client_created_idx
  ON public.stage_readiness_scores(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stage_readiness_scores_peak_week_id_idx
  ON public.stage_readiness_scores(peak_week_id) WHERE peak_week_id IS NOT NULL;

COMMENT ON TABLE public.stage_readiness_scores IS 'Stage readiness: conditioning, fullness, dryness, fatigue scores (e.g. 1–10) and notes.';

-- 3) RLS
ALTER TABLE public.peak_week_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_readiness_scores ENABLE ROW LEVEL SECURITY;

-- peak_week_checkins
DROP POLICY IF EXISTS peak_week_checkins_select_coach ON public.peak_week_checkins;
DROP POLICY IF EXISTS peak_week_checkins_select_client ON public.peak_week_checkins;
DROP POLICY IF EXISTS peak_week_checkins_insert_coach ON public.peak_week_checkins;
DROP POLICY IF EXISTS peak_week_checkins_insert_client ON public.peak_week_checkins;
DROP POLICY IF EXISTS peak_week_checkins_update_coach ON public.peak_week_checkins;
DROP POLICY IF EXISTS peak_week_checkins_update_client ON public.peak_week_checkins;
DROP POLICY IF EXISTS peak_week_checkins_delete_coach ON public.peak_week_checkins;
DROP POLICY IF EXISTS peak_week_checkins_delete_client ON public.peak_week_checkins;

CREATE POLICY peak_week_checkins_select_coach ON public.peak_week_checkins FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_week_checkins.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid()))
);
CREATE POLICY peak_week_checkins_select_client ON public.peak_week_checkins FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_week_checkins.client_id AND c.user_id = auth.uid())
);
CREATE POLICY peak_week_checkins_insert_coach ON public.peak_week_checkins FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_week_checkins.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid()))
);
CREATE POLICY peak_week_checkins_insert_client ON public.peak_week_checkins FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_week_checkins.client_id AND c.user_id = auth.uid())
);
CREATE POLICY peak_week_checkins_update_coach ON public.peak_week_checkins FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_week_checkins.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid()))
);
CREATE POLICY peak_week_checkins_update_client ON public.peak_week_checkins FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_week_checkins.client_id AND c.user_id = auth.uid())
);
CREATE POLICY peak_week_checkins_delete_coach ON public.peak_week_checkins FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_week_checkins.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid()))
);
CREATE POLICY peak_week_checkins_delete_client ON public.peak_week_checkins FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_week_checkins.client_id AND c.user_id = auth.uid())
);

-- stage_readiness_scores
DROP POLICY IF EXISTS stage_readiness_scores_select_coach ON public.stage_readiness_scores;
DROP POLICY IF EXISTS stage_readiness_scores_select_client ON public.stage_readiness_scores;
DROP POLICY IF EXISTS stage_readiness_scores_insert_coach ON public.stage_readiness_scores;
DROP POLICY IF EXISTS stage_readiness_scores_insert_client ON public.stage_readiness_scores;
DROP POLICY IF EXISTS stage_readiness_scores_update_coach ON public.stage_readiness_scores;
DROP POLICY IF EXISTS stage_readiness_scores_update_client ON public.stage_readiness_scores;
DROP POLICY IF EXISTS stage_readiness_scores_delete_coach ON public.stage_readiness_scores;
DROP POLICY IF EXISTS stage_readiness_scores_delete_client ON public.stage_readiness_scores;

CREATE POLICY stage_readiness_scores_select_coach ON public.stage_readiness_scores FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = stage_readiness_scores.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid()))
);
CREATE POLICY stage_readiness_scores_select_client ON public.stage_readiness_scores FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = stage_readiness_scores.client_id AND c.user_id = auth.uid())
);
CREATE POLICY stage_readiness_scores_insert_coach ON public.stage_readiness_scores FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = stage_readiness_scores.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid()))
);
CREATE POLICY stage_readiness_scores_insert_client ON public.stage_readiness_scores FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = stage_readiness_scores.client_id AND c.user_id = auth.uid())
);
CREATE POLICY stage_readiness_scores_update_coach ON public.stage_readiness_scores FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = stage_readiness_scores.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid()))
);
CREATE POLICY stage_readiness_scores_update_client ON public.stage_readiness_scores FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = stage_readiness_scores.client_id AND c.user_id = auth.uid())
);
CREATE POLICY stage_readiness_scores_delete_coach ON public.stage_readiness_scores FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = stage_readiness_scores.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid()))
);
CREATE POLICY stage_readiness_scores_delete_client ON public.stage_readiness_scores FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = stage_readiness_scores.client_id AND c.user_id = auth.uid())
);

-- Table purposes
-- ---------------
-- peak_week_checkins: Daily or periodic check-ins during a peak week (linked to peak_weeks). Stores weight,
--   photo URLs (jsonb array), pump_rating and flat_full_rating (e.g. 1–10), plus coach/client notes.
--   Use for tracking condition and making load/carb/water decisions in the final days.
-- stage_readiness_scores: Aggregated readiness scores (conditioning, fullness, dryness, fatigue) for a client,
--   optionally tied to a peak_week_id. Use for “stage ready” dashboards and coach decision support.
--   Scores are typically 1–10 or similar; notes capture context.
