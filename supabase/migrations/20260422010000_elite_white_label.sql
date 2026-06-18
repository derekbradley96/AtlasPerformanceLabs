-- Elite white-label + custom join page + marketplace listing priority

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brand_name TEXT,
  ADD COLUMN IF NOT EXISTS brand_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS brand_accent_colour TEXT DEFAULT '#3B82F6',
  ADD COLUMN IF NOT EXISTS onboarding_headline TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_message TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_bullets JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.brand_name IS 'Elite: client-visible app name instead of Atlas when set.';
COMMENT ON COLUMN public.profiles.brand_logo_url IS 'Elite: public URL in profile_images bucket for client header.';
COMMENT ON COLUMN public.profiles.brand_accent_colour IS 'Elite: hex accent for client-branded shell.';
COMMENT ON COLUMN public.profiles.onboarding_headline IS 'Elite: custom /join/:code landing headline.';
COMMENT ON COLUMN public.profiles.onboarding_message IS 'Elite: custom join welcome (max ~280 chars in app).';
COMMENT ON COLUMN public.profiles.onboarding_bullets IS 'Elite: JSON array of up to 3 strings for join page value bullets.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'listing_priority'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN listing_priority integer
      GENERATED ALWAYS AS (
        CASE lower(trim(coalesce(plan_tier, '')))
          WHEN 'elite' THEN 0
          WHEN 'pro' THEN 1
          ELSE 2
        END
      ) STORED;
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.listing_priority IS '0=elite,1=pro,2=basic/other — for marketplace sort.';
