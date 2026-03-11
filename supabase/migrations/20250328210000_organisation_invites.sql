-- Pending organisation invites: email + role; token in link for signup/accept flow.
-- Owner/admin can create; invitee accepts after signup to join organisation_members.

CREATE TABLE IF NOT EXISTS public.organisation_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'coach', 'assistant')),
  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_organisation_invites_organisation_id ON public.organisation_invites(organisation_id);
CREATE INDEX IF NOT EXISTS idx_organisation_invites_token ON public.organisation_invites(token) WHERE accepted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_organisation_invites_email ON public.organisation_invites(organisation_id, lower(email));

COMMENT ON TABLE public.organisation_invites IS 'Pending invites to join an organisation; token in link; accept adds organisation_members row.';

ALTER TABLE public.organisation_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organisation_invites_select_org_admin ON public.organisation_invites;
DROP POLICY IF EXISTS organisation_invites_insert_org_admin ON public.organisation_invites;
DROP POLICY IF EXISTS organisation_invites_delete_org_admin ON public.organisation_invites;

CREATE POLICY organisation_invites_select_org_admin ON public.organisation_invites
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.organisations o WHERE o.id = organisation_id AND o.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organisation_members m
      WHERE m.organisation_id = organisation_invites.organisation_id AND m.profile_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  );

CREATE POLICY organisation_invites_insert_org_admin ON public.organisation_invites
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.organisations o WHERE o.id = organisation_id AND o.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organisation_members m
      WHERE m.organisation_id = organisation_invites.organisation_id AND m.profile_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  );

CREATE POLICY organisation_invites_delete_org_admin ON public.organisation_invites
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.organisations o WHERE o.id = organisation_id AND o.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organisation_members m
      WHERE m.organisation_id = organisation_invites.organisation_id AND m.profile_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  );

-- Invitee accept flow: use RPC get_organisation_invite_by_token(token) to fetch invite by token (SECURITY DEFINER).
