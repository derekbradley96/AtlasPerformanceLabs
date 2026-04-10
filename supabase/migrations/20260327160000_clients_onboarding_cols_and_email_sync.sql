-- Add onboarding fields to clients table so client-profile-create can write them.
-- Also fix handle_new_user to populate profiles.email from auth.users.email,
-- and backfill existing profiles.

-- 1) Add missing columns to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS goals TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS previous_experience TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS medical_history TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS onboarding_notes TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS baseline_weight NUMERIC;

-- 2) Update handle_new_user to also set profiles.email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_display_name TEXT;
  v_email TEXT;
BEGIN
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  v_email := NEW.email;

  v_role := LOWER(COALESCE(
    NEW.raw_user_meta_data->>'role',
    NEW.raw_user_meta_data->>'account_type',
    'personal'
  ));

  v_role := CASE
    WHEN v_role IN ('trainer','coach') THEN 'coach'
    WHEN v_role IN ('solo','personal','athlete') THEN 'personal'
    WHEN v_role IN ('client') THEN 'client'
    ELSE 'personal'
  END;

  INSERT INTO public.profiles (id, role, display_name, email)
  VALUES (NEW.id, v_role, v_display_name, v_email)
  ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role,
        display_name = EXCLUDED.display_name,
        email = COALESCE(EXCLUDED.email, profiles.email);

  RETURN NEW;
END;
$$;

-- 3) Update sync_profile_role_to_tables to propagate email to personal table
CREATE OR REPLACE FUNCTION public.sync_profile_role_to_tables()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r TEXT;
  meta_goal TEXT;
  v_email TEXT;
BEGIN
  r := LOWER(TRIM(COALESCE(NEW.role, '')));

  -- Grab email: prefer profiles.email, fall back to auth.users.email
  v_email := NULLIF(TRIM(COALESCE(NEW.email, '')), '');
  IF v_email IS NULL THEN
    SELECT u.email INTO v_email FROM auth.users u WHERE u.id = NEW.id;
  END IF;

  IF r = 'coach' THEN
    INSERT INTO public."Coaches" (coach_id)
    VALUES (NEW.id::text)
    ON CONFLICT (coach_id) DO NOTHING;
    DELETE FROM public.personal WHERE user_id = NEW.id;
    RETURN NEW;
  END IF;

  IF r = 'personal' THEN
    SELECT NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'personal_goal', '')), '')
      INTO meta_goal
    FROM auth.users u
    WHERE u.id = NEW.id;

    INSERT INTO public.personal (user_id, display_name, email, primary_goal, updated_at)
    VALUES (
      NEW.id,
      NULLIF(TRIM(COALESCE(NEW.display_name, '')), ''),
      v_email,
      meta_goal,
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      display_name = COALESCE(EXCLUDED.display_name, public.personal.display_name),
      email = COALESCE(EXCLUDED.email, public.personal.email),
      primary_goal = COALESCE(EXCLUDED.primary_goal, public.personal.primary_goal),
      updated_at = now();
    RETURN NEW;
  END IF;

  IF r = 'client' THEN
    DELETE FROM public.personal WHERE user_id = NEW.id;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- 4) Backfill existing profiles.email from auth.users.email where null
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.id
  AND (p.email IS NULL OR p.email = '');

-- 5) Backfill personal.email from auth.users.email where null
UPDATE public.personal pe
SET email = u.email
FROM auth.users u
WHERE u.id = pe.user_id
  AND (pe.email IS NULL OR pe.email = '');
