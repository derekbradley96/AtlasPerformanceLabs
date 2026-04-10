-- Personal (solo) onboarding: experience + basic stats stored on public.personal.
ALTER TABLE public.personal
  ADD COLUMN IF NOT EXISTS experience_level TEXT,
  ADD COLUMN IF NOT EXISTS baseline_weight_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS height_cm NUMERIC,
  ADD COLUMN IF NOT EXISTS target_note TEXT;

COMMENT ON COLUMN public.personal.experience_level IS 'Self-reported training level from onboarding.';
COMMENT ON COLUMN public.personal.baseline_weight_kg IS 'Optional weight from onboarding (kg).';
COMMENT ON COLUMN public.personal.height_cm IS 'Optional height from onboarding (cm).';
COMMENT ON COLUMN public.personal.target_note IS 'Optional target or focus note from onboarding.';

ALTER TABLE public.personal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS personal_select_own ON public.personal;
CREATE POLICY personal_select_own ON public.personal
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS personal_insert_own ON public.personal;
CREATE POLICY personal_insert_own ON public.personal
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS personal_update_own ON public.personal;
CREATE POLICY personal_update_own ON public.personal
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS personal_delete_own ON public.personal;
CREATE POLICY personal_delete_own ON public.personal
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
