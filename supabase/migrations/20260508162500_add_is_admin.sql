ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Set the admin user (run manually once, then remove this line):
-- UPDATE profiles SET is_admin = true WHERE email = 'your-email@example.com';

-- Only service_role may change profiles.is_admin.
CREATE OR REPLACE FUNCTION public.enforce_profiles_is_admin_write_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user <> 'service_role' AND NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    RAISE EXCEPTION 'Only service_role can modify profiles.is_admin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_is_admin_write_guard ON public.profiles;
CREATE TRIGGER trg_profiles_is_admin_write_guard
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profiles_is_admin_write_guard();

DROP POLICY IF EXISTS profiles_select_own_is_admin ON public.profiles;
CREATE POLICY profiles_select_own_is_admin ON public.profiles
  FOR SELECT
  USING (id = auth.uid());
