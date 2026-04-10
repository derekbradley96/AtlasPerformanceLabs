-- Coach billing tier on public.profiles (used by AuthContext + CoachOnboardingFlow).
-- Edge functions and Stripe helpers still use atlas_coaches.plan_tier where applicable.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_tier text;

COMMENT ON COLUMN public.profiles.plan_tier IS 'Coach plan: basic | pro | elite. NULL until chosen or skipped.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_plan_tier_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_plan_tier_check
      CHECK (plan_tier IS NULL OR LOWER(plan_tier) IN ('basic', 'pro', 'elite'));
  END IF;
END $$;
