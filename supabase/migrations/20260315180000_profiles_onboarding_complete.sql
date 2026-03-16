-- Store coach onboarding completion in profiles for beta onboarding flow.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_onboarding_complete_idx
  ON public.profiles(onboarding_complete)
  WHERE onboarding_complete = false;

COMMENT ON COLUMN public.profiles.onboarding_complete IS 'True when coach has completed the beta onboarding flow (welcome, coach type, focus, add client, program, dashboard).';
