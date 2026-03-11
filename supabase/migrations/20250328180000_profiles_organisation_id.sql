-- Link profiles to an organisation (optional).
-- Coaches can belong to one organisation via profiles.organisation_id.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_organisation_id
  ON public.profiles(organisation_id)
  WHERE organisation_id IS NOT NULL;

COMMENT ON COLUMN public.profiles.organisation_id IS 'Optional: organisation this profile (coach) belongs to.';
