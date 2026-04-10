-- Personal onboarding: training frequency and numeric target weight (optional).
ALTER TABLE public.personal
  ADD COLUMN IF NOT EXISTS training_days_per_week INTEGER,
  ADD COLUMN IF NOT EXISTS target_weight_kg NUMERIC;

COMMENT ON COLUMN public.personal.training_days_per_week IS 'Self-reported training days per week from onboarding.';
COMMENT ON COLUMN public.personal.target_weight_kg IS 'Optional target body weight (kg) from onboarding.';
