-- Personal onboarding: equipment + confidence (influences in-app guidance prompts; not billing).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS personal_training_equipment text,
  ADD COLUMN IF NOT EXISTS personal_training_confidence text;

COMMENT ON COLUMN public.profiles.personal_training_equipment IS 'Personal onboarding: equipment context (e.g. full_gym, home_minimal).';
COMMENT ON COLUMN public.profiles.personal_training_confidence IS 'Personal onboarding: low | medium | high — used to tune upgrade prompt cadence.';
