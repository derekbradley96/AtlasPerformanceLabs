-- Ensure profile photo URL column exists (marketplace + AuthContext use profiles.avatar_url).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN public.profiles.avatar_url IS 'Public HTTPS URL for avatar (profile_images bucket; see 20260408130000_profile_images_public_bucket.sql).';
