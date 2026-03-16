-- Fix "Database error saving new user": ensure profile creation on auth signup always succeeds.
-- Canonical roles only: coach, client, personal. Default personal. Never write trainer/solo/athlete.
-- Idempotent: safe to run multiple times.

-- =============================================================================
-- 1) Ensure public.profiles has required columns (table may exist from dashboard/template)
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS coach_focus TEXT;

-- Ensure coach_focus constraint allows only valid values and NULL (drop if exists, re-add)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_coach_focus_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_coach_focus_check
  CHECK (coach_focus IS NULL OR LOWER(TRIM(coach_focus)) IN ('transformation', 'competition', 'integrated'));

-- Role constraint: only canonical roles (and NULL for legacy rows). No trainer/solo/athlete.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IS NULL OR LOWER(TRIM(role)) IN ('coach', 'client', 'personal'));

COMMENT ON COLUMN public.profiles.role IS 'Canonical: coach | client | personal. Default personal for new users.';
COMMENT ON COLUMN public.profiles.coach_focus IS 'Only for role=coach: transformation | competition | integrated.';

-- =============================================================================
-- 2) Trigger function: create/update profile row on auth.users insert
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta JSONB;
  canonical_role TEXT;
  display_name_val TEXT;
  coach_focus_val TEXT;
BEGIN
  meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);

  -- Normalize role: only coach, client, personal. Map legacy; default personal.
  canonical_role := LOWER(TRIM(COALESCE(meta->>'role', '')));
  IF canonical_role NOT IN ('coach', 'client', 'personal') THEN
    IF canonical_role = 'trainer' THEN
      canonical_role := 'coach';
    ELSIF canonical_role IN ('solo', 'athlete') THEN
      canonical_role := 'personal';
    ELSE
      canonical_role := 'personal';
    END IF;
  END IF;

  display_name_val := TRIM(COALESCE(meta->>'display_name', ''));
  IF display_name_val = '' AND NEW.email IS NOT NULL THEN
    display_name_val := SPLIT_PART(NEW.email, '@', 1);
  END IF;
  IF display_name_val = '' THEN
    display_name_val := 'User';
  END IF;

  coach_focus_val := NULL;
  IF canonical_role = 'coach' THEN
    coach_focus_val := LOWER(TRIM(COALESCE(meta->>'coach_focus', '')));
    IF coach_focus_val NOT IN ('transformation', 'competition', 'integrated') THEN
      coach_focus_val := 'transformation';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, user_id, role, display_name, coach_focus)
  VALUES (
    NEW.id,
    NEW.id,
    canonical_role,
    display_name_val,
    coach_focus_val
  )
  ON CONFLICT (id) DO UPDATE SET
    user_id = COALESCE(EXCLUDED.user_id, public.profiles.user_id),
    role = COALESCE(EXCLUDED.role, public.profiles.role),
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
    coach_focus = COALESCE(EXCLUDED.coach_focus, public.profiles.coach_focus);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[handle_new_user_profile] failed for user %: %', NEW.id, SQLERRM;
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user_profile() IS 'Trigger: create/update public.profiles on auth.users insert. Canonical roles only.';

-- =============================================================================
-- 3) Attach trigger to auth.users
-- =============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created_create_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_create_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();

-- =============================================================================
-- 4) Backfill: insert missing profile rows for existing auth.users
-- =============================================================================

INSERT INTO public.profiles (id, user_id, role, display_name, coach_focus)
SELECT
  u.id,
  u.id,
  CASE
    WHEN LOWER(TRIM(COALESCE(u.raw_user_meta_data->>'role', ''))) = 'trainer' THEN 'coach'
    WHEN LOWER(TRIM(COALESCE(u.raw_user_meta_data->>'role', ''))) IN ('solo', 'athlete') THEN 'personal'
    WHEN LOWER(TRIM(COALESCE(u.raw_user_meta_data->>'role', ''))) IN ('coach', 'client', 'personal') THEN LOWER(TRIM(u.raw_user_meta_data->>'role'))
    ELSE 'personal'
  END,
  COALESCE(NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'display_name', '')), ''), SPLIT_PART(u.email, '@', 1), 'User'),
  NULL
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;
