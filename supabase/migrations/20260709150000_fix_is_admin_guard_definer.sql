-- The profiles.is_admin write guard was SECURITY DEFINER (owner postgres), so
-- current_user inside the trigger was always 'postgres' — the
-- current_user = 'service_role' check could never pass and NOBODY (including
-- legitimate service-role backend code) could modify is_admin. SECURITY
-- INVOKER makes the check see the actual caller; postgres is allowed too so
-- dashboard/ops SQL keeps working.
CREATE OR REPLACE FUNCTION public.enforce_profiles_is_admin_write_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') AND NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    RAISE EXCEPTION 'Only service_role can modify profiles.is_admin';
  END IF;
  RETURN NEW;
END;
$$;
