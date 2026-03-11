-- Allow organisation members to read clients that belong to their organisation.
-- Enables organisation dashboard to show total clients and coach workload.

DROP POLICY IF EXISTS clients_select_org_member ON public.clients;

CREATE POLICY clients_select_org_member ON public.clients
  FOR SELECT USING (
    organisation_id IS NOT NULL
    AND (
      organisation_id IN (SELECT organisation_id FROM public.organisation_members WHERE profile_id = auth.uid())
      OR organisation_id IN (SELECT id FROM public.organisations WHERE owner_id = auth.uid())
    )
  );

COMMENT ON POLICY clients_select_org_member ON public.clients IS 'Org members and org owners can read clients belonging to their organisation.';

-- Allow org members to read checkins for clients in their org (for workload: check-ins pending).
DROP POLICY IF EXISTS checkins_select_org_member ON public.checkins;

CREATE POLICY checkins_select_org_member ON public.checkins
  FOR SELECT USING (
    client_id IN (
      SELECT c.id FROM public.clients c
      WHERE c.organisation_id IS NOT NULL
        AND (
          c.organisation_id IN (SELECT organisation_id FROM public.organisation_members WHERE profile_id = auth.uid())
          OR c.organisation_id IN (SELECT id FROM public.organisations WHERE owner_id = auth.uid())
        )
    )
  );
