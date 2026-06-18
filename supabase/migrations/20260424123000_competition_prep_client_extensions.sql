-- Extensions for competition-prep client features: pace flag, coach education keys, prep pacing fields, RPC.

-- 1) Check-ins: athlete-acknowledged prep pace (client sets via RPC; coach reads).
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS athlete_prep_pace_ack TEXT,
  ADD COLUMN IF NOT EXISTS athlete_prep_pace_ack_at TIMESTAMPTZ;

COMMENT ON COLUMN public.checkins.athlete_prep_pace_ack IS 'Client prep pace self-assessment after viewing progress: behind | ahead | on_track.';

CREATE OR REPLACE FUNCTION public.set_athlete_prep_pace_ack(p_checkin_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_checkin_id IS NULL OR p_status IS NULL OR length(trim(p_status)) = 0 THEN
    RETURN;
  END IF;
  UPDATE public.checkins c
  SET
    athlete_prep_pace_ack = trim(p_status),
    athlete_prep_pace_ack_at = now()
  WHERE c.id = p_checkin_id
    AND c.client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.set_athlete_prep_pace_ack(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_athlete_prep_pace_ack(uuid, text) TO authenticated;

-- 2) Contest prep: optional pacing + weekly posing target (coach-editable).
ALTER TABLE public.contest_preps
  ADD COLUMN IF NOT EXISTS prep_start_date DATE,
  ADD COLUMN IF NOT EXISTS prep_start_weight_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS target_stage_weight_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS posing_target_weekly_minutes INTEGER;

COMMENT ON COLUMN public.contest_preps.posing_target_weekly_minutes IS 'Coach target for weekly posing minutes (prep clients).';

-- 3) Nutrition plan: optional education key for saved coach notes.
ALTER TABLE public.nutrition_plans
  ADD COLUMN IF NOT EXISTS prep_instruction_explanation_key TEXT;

COMMENT ON COLUMN public.nutrition_plans.prep_instruction_explanation_key IS 'Key into PREP_EDUCATION for client-facing Why? copy.';

-- 4) Program exercises: optional education key tied to coach notes.
ALTER TABLE public.program_exercises
  ADD COLUMN IF NOT EXISTS prep_instruction_explanation_key TEXT;

COMMENT ON COLUMN public.program_exercises.prep_instruction_explanation_key IS 'Key into PREP_EDUCATION for client-facing Why? on coach notes.';
