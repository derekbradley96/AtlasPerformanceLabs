-- Break RLS recursion cycle: organisations SELECT/UPDATE policies query organisation_members,
-- and organisation_members policies query organisations. When both use inline subqueries we get
-- infinite recursion. Use SECURITY DEFINER functions so organisations policies do not trigger
-- organisation_members RLS.

-- Returns organisation ids where the current user has an active membership (no RLS on organisation_members).
CREATE OR REPLACE FUNCTION public.current_user_organisation_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.organisation_id
  FROM public.organisation_members m
  WHERE m.profile_id = auth.uid()
    AND COALESCE(m.is_active, true) = true;
$$;

COMMENT ON FUNCTION public.current_user_organisation_ids() IS
  'Returns organisation ids where the current user is an active member. Used in organisations RLS to avoid recursion.';

-- Recreate organisations SELECT so it does not query organisation_members (use the function instead).
DROP POLICY IF EXISTS organisations_select_member ON public.organisations;
CREATE POLICY organisations_select_member ON public.organisations
  FOR SELECT USING (
    id IN (SELECT public.current_user_organisation_ids())
    OR owner_profile_id = auth.uid()
  );

-- Recreate organisations UPDATE so it does not query organisation_members (use existing helper).
DROP POLICY IF EXISTS organisations_update_owner_admin ON public.organisations;
CREATE POLICY organisations_update_owner_admin ON public.organisations
  FOR UPDATE USING (
    owner_profile_id = auth.uid()
    OR public.current_user_is_org_owner_or_admin(id)
  );

-- Clients and checkins: org-based SELECT must not query organisation_members (use helper to avoid recursion).
DROP POLICY IF EXISTS clients_select_org_member ON public.clients;
CREATE POLICY clients_select_org_member ON public.clients
  FOR SELECT USING (
    organisation_id IS NOT NULL
    AND (
      organisation_id IN (SELECT public.current_user_organisation_ids())
      OR organisation_id IN (SELECT id FROM public.organisations WHERE owner_profile_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS checkins_select_org_member ON public.checkins;
CREATE POLICY checkins_select_org_member ON public.checkins
  FOR SELECT USING (
    client_id IN (
      SELECT c.id FROM public.clients c
      WHERE c.organisation_id IS NOT NULL
        AND (
          c.organisation_id IN (SELECT public.current_user_organisation_ids())
          OR c.organisation_id IN (SELECT id FROM public.organisations WHERE owner_profile_id = auth.uid())
        )
    )
  );
