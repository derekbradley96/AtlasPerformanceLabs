-- Populate profiles.email from auth.users on signup so profiles show email in Table Editor.
-- Keeps handle_new_user_profile in sync; idempotent.
-- (Unique version 20260325120100 to avoid collision with 20260325120000_notification_preferences.)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN public.profiles.email IS 'Copy of auth.users.email for display/support; set by handle_new_user_profile.';

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
  email_val TEXT;
BEGIN
  meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  email_val := NULLIF(TRIM(COALESCE(NEW.email, '')), '');

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

  INSERT INTO public.profiles (id, user_id, role, display_name, coach_focus, email)
  VALUES (
    NEW.id,
    NEW.id,
    canonical_role,
    display_name_val,
    coach_focus_val,
    email_val
  )
  ON CONFLICT (id) DO UPDATE SET
    user_id = COALESCE(EXCLUDED.user_id, public.profiles.user_id),
    role = COALESCE(EXCLUDED.role, public.profiles.role),
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
    coach_focus = COALESCE(EXCLUDED.coach_focus, public.profiles.coach_focus),
    email = COALESCE(EXCLUDED.email, public.profiles.email);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[handle_new_user_profile] failed for user %: %', NEW.id, SQLERRM;
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user_profile() IS 'Trigger: create/update public.profiles on auth.users insert. Sets email from auth.users.';

-- Backfill email for existing profiles from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '') AND u.email IS NOT NULL;
