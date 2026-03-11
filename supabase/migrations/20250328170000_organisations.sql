-- Organisation support for coaching teams.
-- organisations: one per team/studio; owner_id = profiles.id.
-- organisation_members: membership with role (owner, admin, coach, assistant).

CREATE TABLE IF NOT EXISTS public.organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organisations_owner_id ON public.organisations(owner_id);

COMMENT ON TABLE public.organisations IS 'Coaching teams/studios; owner_id is the organisation owner (profile).';

ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

-- Organisation members: profile + org + role
CREATE TABLE IF NOT EXISTS public.organisation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL
    CHECK (role IN ('owner', 'admin', 'coach', 'assistant')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_organisation_members_organisation_id ON public.organisation_members(organisation_id);
CREATE INDEX IF NOT EXISTS idx_organisation_members_profile_id ON public.organisation_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_organisation_members_role ON public.organisation_members(role);

COMMENT ON TABLE public.organisation_members IS 'Membership of a profile in an organisation; roles: owner, admin, coach, assistant.';
COMMENT ON COLUMN public.organisation_members.role IS 'owner | admin | coach | assistant';

ALTER TABLE public.organisation_members ENABLE ROW LEVEL SECURITY;

-- Policies: owners/admins can manage org and members; members can read org and list members.
-- Owner is also stored on organisations.owner_id; organisation_members can have role owner for consistency.

DROP POLICY IF EXISTS organisations_select_member ON public.organisations;
DROP POLICY IF EXISTS organisations_insert_owner ON public.organisations;
DROP POLICY IF EXISTS organisations_update_owner_admin ON public.organisations;
DROP POLICY IF EXISTS organisations_delete_owner ON public.organisations;

CREATE POLICY organisations_select_member ON public.organisations
  FOR SELECT USING (
    id IN (SELECT organisation_id FROM public.organisation_members WHERE profile_id = auth.uid())
    OR owner_id = auth.uid()
  );

CREATE POLICY organisations_insert_owner ON public.organisations
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY organisations_update_owner_admin ON public.organisations
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organisation_members m
      WHERE m.organisation_id = organisations.id AND m.profile_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  );

CREATE POLICY organisations_delete_owner ON public.organisations
  FOR DELETE USING (owner_id = auth.uid());

-- organisation_members: members can read; owner/admin can insert/update/delete.
DROP POLICY IF EXISTS organisation_members_select ON public.organisation_members;
DROP POLICY IF EXISTS organisation_members_insert ON public.organisation_members;
DROP POLICY IF EXISTS organisation_members_update ON public.organisation_members;
DROP POLICY IF EXISTS organisation_members_delete ON public.organisation_members;

CREATE POLICY organisation_members_select ON public.organisation_members
  FOR SELECT USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organisation_members m2
      WHERE m2.organisation_id = organisation_members.organisation_id AND m2.profile_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.organisations o WHERE o.id = organisation_members.organisation_id AND o.owner_id = auth.uid())
  );

CREATE POLICY organisation_members_insert ON public.organisation_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.organisations o WHERE o.id = organisation_id AND o.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organisation_members m2
      WHERE m2.organisation_id = organisation_members.organisation_id AND m2.profile_id = auth.uid() AND m2.role IN ('owner', 'admin')
    )
  );

CREATE POLICY organisation_members_update ON public.organisation_members
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.organisations o WHERE o.id = organisation_id AND o.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organisation_members m2
      WHERE m2.organisation_id = organisation_members.organisation_id AND m2.profile_id = auth.uid() AND m2.role IN ('owner', 'admin')
    )
  );

CREATE POLICY organisation_members_delete ON public.organisation_members
  FOR DELETE USING (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.organisations o WHERE o.id = organisation_id AND o.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organisation_members m2
      WHERE m2.organisation_id = organisation_members.organisation_id AND m2.profile_id = auth.uid() AND m2.role IN ('owner', 'admin')
    )
  );
