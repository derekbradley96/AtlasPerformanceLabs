-- Fix infinite recursion in RLS on organisation_members: policies that use
-- (SELECT ... FROM organisation_members WHERE ...) trigger RLS on the same table.
-- Use SECURITY DEFINER functions so the check reads organisation_members without RLS.

CREATE OR REPLACE FUNCTION public.current_user_is_org_member(p_organisation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organisation_members m
    WHERE m.organisation_id = p_organisation_id
      AND m.profile_id = auth.uid()
      AND COALESCE(m.is_active, true) = true
  );
$$;

COMMENT ON FUNCTION public.current_user_is_org_member(uuid) IS
  'Returns true if the current user has an active membership in the given organisation. Used in RLS to avoid recursion.';

CREATE OR REPLACE FUNCTION public.current_user_is_org_owner_or_admin(p_organisation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organisation_members m
    WHERE m.organisation_id = p_organisation_id
      AND m.profile_id = auth.uid()
      AND COALESCE(m.is_active, true) = true
      AND LOWER(COALESCE(m.role, '')) IN ('owner', 'admin')
  );
$$;

COMMENT ON FUNCTION public.current_user_is_org_owner_or_admin(uuid) IS
  'Returns true if the current user is owner or admin of the given organisation. Used in RLS to avoid recursion.';

-- Recreate organisation_members policies using the functions instead of inline subqueries.

DROP POLICY IF EXISTS organisation_members_select ON public.organisation_members;
CREATE POLICY organisation_members_select ON public.organisation_members
  FOR SELECT USING (
    profile_id = auth.uid()
    OR public.current_user_is_org_member(organisation_id)
    OR EXISTS (SELECT 1 FROM public.organisations o WHERE o.id = organisation_members.organisation_id AND o.owner_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS organisation_members_insert ON public.organisation_members;
CREATE POLICY organisation_members_insert ON public.organisation_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.organisations o WHERE o.id = organisation_id AND o.owner_profile_id = auth.uid())
    OR public.current_user_is_org_owner_or_admin(organisation_id)
  );

DROP POLICY IF EXISTS organisation_members_update ON public.organisation_members;
CREATE POLICY organisation_members_update ON public.organisation_members
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.organisations o WHERE o.id = organisation_id AND o.owner_profile_id = auth.uid())
    OR public.current_user_is_org_owner_or_admin(organisation_id)
  );

DROP POLICY IF EXISTS organisation_members_delete ON public.organisation_members;
CREATE POLICY organisation_members_delete ON public.organisation_members
  FOR DELETE USING (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.organisations o WHERE o.id = organisation_id AND o.owner_profile_id = auth.uid())
    OR public.current_user_is_org_owner_or_admin(organisation_id)
  );
