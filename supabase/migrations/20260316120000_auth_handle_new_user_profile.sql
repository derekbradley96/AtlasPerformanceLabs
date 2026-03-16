-- Ensure new auth.users get a public.profiles row (fixes "Database error saving new user").
-- Canonical roles only: coach, client, personal. Default personal. Never write trainer/solo/athlete.
-- Reads raw_user_meta_data.role, display_name, coach_focus; writes only canonical role.

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

  -- Canonical role: only coach, client, personal. Map legacy reads to canonical; default personal.
  canonical_role := LOWER(TRIM(COALESCE(meta->>'role', '')));
  IF canonical_role NOT IN ('coach', 'client', 'personal') THEN
    IF canonical_role IN ('trainer') THEN
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
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[handle_new_user_profile] failed for user %: %', NEW.id, SQLERRM;
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user_profile() IS 'Trigger: create public.profiles row on auth.users insert. Writes canonical role (coach|client|personal) only.';

DROP TRIGGER IF EXISTS on_auth_user_created_create_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_create_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();
