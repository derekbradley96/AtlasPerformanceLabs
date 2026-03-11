-- Add reviewed_at and reviewed_by to public.checkins for coach Review Center.
-- RLS: coach update policy already allows coach to update owned clients' checkins.

ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID;

COMMENT ON COLUMN public.checkins.reviewed_at IS 'Set when coach marks check-in as reviewed.';
COMMENT ON COLUMN public.checkins.reviewed_by IS 'auth.uid() of coach who reviewed.';

-- Recreate view to include reviewed fields (used by Review Center list).
DROP VIEW IF EXISTS public.v_client_latest_checkin;
CREATE VIEW public.v_client_latest_checkin AS
SELECT DISTINCT ON (c.client_id)
  c.client_id,
  c.id AS checkin_id,
  c.week_start,
  c.submitted_at,
  c.reviewed_at,
  c.reviewed_by,
  c.focus_type,
  c.weight,
  c.steps_avg,
  c.sleep_score,
  c.energy_level,
  c.training_completion,
  c.nutrition_adherence,
  c.cardio_completion,
  c.posing_minutes,
  c.pump_quality,
  c.digestion_score,
  c.wins,
  c.struggles,
  c.questions,
  c.photos
FROM public.checkins c
ORDER BY c.client_id, c.submitted_at DESC NULLS LAST;

ALTER VIEW public.v_client_latest_checkin SET (security_invoker = on);
COMMENT ON VIEW public.v_client_latest_checkin IS 'One row per client_id with latest checkin and adherence fields.';
