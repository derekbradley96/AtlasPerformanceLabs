-- Optional coach-facing profile fields used during onboarding (marketplace can still use separate tables).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coaching_style TEXT,
  ADD COLUMN IF NOT EXISTS niche_tags TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.profiles.coaching_style IS 'Short coaching approach / style blurb; set during coach onboarding.';
COMMENT ON COLUMN public.profiles.niche_tags IS 'Optional niche tags (e.g. women''s health, powerlifting).';
