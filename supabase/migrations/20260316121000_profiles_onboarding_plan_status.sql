-- Persist coach onboarding plan-selection status.
-- Allows distinguishing selected tier vs skipped ("plan_not_selected").

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_plan_status text NOT NULL DEFAULT 'plan_not_selected';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_onboarding_plan_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_onboarding_plan_status_check
      CHECK (onboarding_plan_status IN ('selected', 'plan_not_selected'));
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.onboarding_plan_status IS
  'Coach onboarding plan status: selected when a tier is chosen, plan_not_selected when skipped.';
