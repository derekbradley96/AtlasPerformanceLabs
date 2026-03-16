-- Fix infinite recursion in RLS: policies that check (SELECT ... FROM profiles WHERE id = auth.uid())
-- cause recursion when the policy is ON profiles. Use a SECURITY DEFINER function so the check
-- reads profiles without triggering RLS.

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false);
$$;

COMMENT ON FUNCTION public.current_user_is_admin() IS 'Returns true if the current auth user has is_admin = true on their profile. Used in RLS to avoid recursion.';

-- Replace inline subqueries with the function in all admin policies that reference profiles.

-- Organisations
DROP POLICY IF EXISTS organisations_select_admin ON public.organisations;
CREATE POLICY organisations_select_admin ON public.organisations
  FOR SELECT
  USING (public.current_user_is_admin());

-- Organisation members
DROP POLICY IF EXISTS organisation_members_select_admin ON public.organisation_members;
CREATE POLICY organisation_members_select_admin ON public.organisation_members
  FOR SELECT
  USING (public.current_user_is_admin());

-- Clients
DROP POLICY IF EXISTS clients_select_admin ON public.clients;
CREATE POLICY clients_select_admin ON public.clients
  FOR SELECT
  USING (public.current_user_is_admin());

-- Client payments
DROP POLICY IF EXISTS client_payments_select_admin ON public.client_payments;
CREATE POLICY client_payments_select_admin ON public.client_payments
  FOR SELECT
  USING (public.current_user_is_admin());

-- Profiles (this was the one causing recursion)
DROP POLICY IF EXISTS profiles_select_admin ON public.profiles;
CREATE POLICY profiles_select_admin ON public.profiles
  FOR SELECT
  USING (public.current_user_is_admin());
