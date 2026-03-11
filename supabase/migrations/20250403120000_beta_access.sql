-- Beta access: controlled rollout and user segmentation.
-- App remains usable for non-beta users; use is_beta_user / beta_group for feature gating only.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_beta_user BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS beta_group TEXT;

COMMENT ON COLUMN public.profiles.is_beta_user IS 'When true, user is in the beta program and can access beta-gated features.';
COMMENT ON COLUMN public.profiles.beta_group IS 'Optional segment for beta (e.g. early_access, pilot). Used with canAccessFeature(profile, featureKey).';

CREATE INDEX IF NOT EXISTS idx_profiles_is_beta_user ON public.profiles(is_beta_user) WHERE is_beta_user = true;
CREATE INDEX IF NOT EXISTS idx_profiles_beta_group ON public.profiles(beta_group) WHERE beta_group IS NOT NULL;
