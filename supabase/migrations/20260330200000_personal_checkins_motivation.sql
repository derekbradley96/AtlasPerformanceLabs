-- Subjective motivation (1–5) for readiness; complements energy, recovery, stress.

ALTER TABLE public.personal_checkins
  ADD COLUMN IF NOT EXISTS motivation INTEGER CHECK (motivation BETWEEN 1 AND 5);

COMMENT ON COLUMN public.personal_checkins.motivation IS 'Daily motivation 1–5 (readiness check-in).';
