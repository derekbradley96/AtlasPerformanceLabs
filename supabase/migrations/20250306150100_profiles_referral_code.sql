-- Give every coach a referral code. Format: atlas-XXXX (4 hex chars).
-- Column on profiles; generated on insert when null.

-- 1) Add column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_key
  ON public.profiles(referral_code) WHERE referral_code IS NOT NULL;

COMMENT ON COLUMN public.profiles.referral_code IS 'Unique referral code for coaches, format atlas-XXXX. Set on profile creation.';

-- 2) Function: generate a unique referral_code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  code TEXT;
  attempt INT := 0;
BEGIN
  LOOP
    code := 'atlas-' || lower(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 4));
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = code) THEN
      RETURN code;
    END IF;
    attempt := attempt + 1;
    IF attempt > 10 THEN
      -- Fallback: use more entropy
      code := 'atlas-' || lower(substr(md5(gen_random_uuid()::text || random()::text), 1, 6));
      RETURN code;
    END IF;
  END LOOP;
END;
$$;

-- 3) Trigger: set referral_code on INSERT when null
CREATE OR REPLACE FUNCTION public.set_profile_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profile_referral_code_trigger ON public.profiles;
CREATE TRIGGER set_profile_referral_code_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_profile_referral_code();

-- 4) Backfill existing profiles that have no code
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE referral_code IS NULL
  LOOP
    UPDATE public.profiles
    SET referral_code = public.generate_referral_code()
    WHERE id = r.id;
  END LOOP;
END $$;
