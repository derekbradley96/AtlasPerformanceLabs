-- Organisation and membership tables: full schema for multi-coach businesses.
-- Extends existing public.organisations and public.organisation_members when present;
-- otherwise creates them from scratch with slug, owner_profile_id, updated_at, is_active, posing_coach.

-- =============================================================================
-- 0) DROP POLICIES THAT DEPEND ON organisations.owner_id (so we can drop that column)
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organisations' AND column_name = 'owner_id') THEN
    DROP POLICY IF EXISTS organisations_select_member ON public.organisations;
    DROP POLICY IF EXISTS organisations_insert_owner ON public.organisations;
    DROP POLICY IF EXISTS organisations_update_owner_admin ON public.organisations;
    DROP POLICY IF EXISTS organisations_delete_owner ON public.organisations;
    DROP POLICY IF EXISTS organisation_members_select ON public.organisation_members;
    DROP POLICY IF EXISTS organisation_members_insert ON public.organisation_members;
    DROP POLICY IF EXISTS organisation_members_update ON public.organisation_members;
    DROP POLICY IF EXISTS organisation_members_delete ON public.organisation_members;
    DROP POLICY IF EXISTS clients_select_org_member ON public.clients;
    DROP POLICY IF EXISTS checkins_select_org_member ON public.checkins;
    DROP POLICY IF EXISTS organisation_invites_select_org_admin ON public.organisation_invites;
    DROP POLICY IF EXISTS organisation_invites_insert_org_admin ON public.organisation_invites;
    DROP POLICY IF EXISTS organisation_invites_delete_org_admin ON public.organisation_invites;
  END IF;
END $$;

-- =============================================================================
-- 1) ORGANISATIONS
-- =============================================================================

-- Ensure organisations has required columns (idempotent for existing table)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organisations') THEN
    -- Add slug if missing (unique, nullable for backfill)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organisations' AND column_name = 'slug') THEN
      ALTER TABLE public.organisations ADD COLUMN slug TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS organisations_slug_key ON public.organisations(slug) WHERE slug IS NOT NULL;
      COMMENT ON COLUMN public.organisations.slug IS 'URL-friendly unique identifier for the organisation.';
    END IF;
    -- Add updated_at if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organisations' AND column_name = 'updated_at') THEN
      ALTER TABLE public.organisations ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
      COMMENT ON COLUMN public.organisations.updated_at IS 'Last updated timestamp.';
    END IF;
    -- Add owner_profile_id if missing (for alignment with spec); backfill from owner_id then drop owner_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organisations' AND column_name = 'owner_profile_id') THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organisations' AND column_name = 'owner_id') THEN
        ALTER TABLE public.organisations ADD COLUMN owner_profile_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT;
        UPDATE public.organisations SET owner_profile_id = owner_id;
        ALTER TABLE public.organisations ALTER COLUMN owner_profile_id SET NOT NULL;
        ALTER TABLE public.organisations DROP COLUMN owner_id;
        COMMENT ON COLUMN public.organisations.owner_profile_id IS 'Profile ID of the organisation owner.';
      ELSE
        -- No owner_id; add owner_profile_id as not null (will fail if rows exist without a way to backfill)
        ALTER TABLE public.organisations ADD COLUMN owner_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT;
        COMMENT ON COLUMN public.organisations.owner_profile_id IS 'Profile ID of the organisation owner.';
      END IF;
    END IF;
  ELSE
    -- Create from scratch
    CREATE TABLE public.organisations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT,
      owner_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS organisations_slug_key ON public.organisations(slug) WHERE slug IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_organisations_owner_id ON public.organisations(owner_profile_id);
    COMMENT ON TABLE public.organisations IS 'Organisations (businesses/brands) that can have multiple coaches.';
    COMMENT ON COLUMN public.organisations.slug IS 'URL-friendly unique identifier for the organisation.';
    COMMENT ON COLUMN public.organisations.owner_profile_id IS 'Profile ID of the organisation owner.';
    ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- updated_at trigger for organisations
CREATE OR REPLACE FUNCTION public.set_organisations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS organisations_updated_at_trigger ON public.organisations;
CREATE TRIGGER organisations_updated_at_trigger
  BEFORE UPDATE ON public.organisations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_organisations_updated_at();

-- Recreate RLS policies to use owner_profile_id if column exists (handles rename from owner_id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organisations' AND column_name = 'owner_profile_id') THEN
    DROP POLICY IF EXISTS organisations_select_member ON public.organisations;
    CREATE POLICY organisations_select_member ON public.organisations
      FOR SELECT USING (
        id IN (SELECT organisation_id FROM public.organisation_members WHERE profile_id = auth.uid())
        OR owner_profile_id = auth.uid()
      );
    DROP POLICY IF EXISTS organisations_insert_owner ON public.organisations;
    CREATE POLICY organisations_insert_owner ON public.organisations
      FOR INSERT WITH CHECK (owner_profile_id = auth.uid());
    DROP POLICY IF EXISTS organisations_update_owner_admin ON public.organisations;
    CREATE POLICY organisations_update_owner_admin ON public.organisations
      FOR UPDATE USING (
        owner_profile_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.organisation_members m
          WHERE m.organisation_id = organisations.id AND m.profile_id = auth.uid() AND m.role IN ('owner', 'admin')
        )
      );
    DROP POLICY IF EXISTS organisations_delete_owner ON public.organisations;
    CREATE POLICY organisations_delete_owner ON public.organisations
      FOR DELETE USING (owner_profile_id = auth.uid());
  END IF;
END $$;

-- =============================================================================
-- 2) ORGANISATION_MEMBERS
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organisation_members') THEN
    -- Add is_active if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organisation_members' AND column_name = 'is_active') THEN
      ALTER TABLE public.organisation_members ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
      COMMENT ON COLUMN public.organisation_members.is_active IS 'When false, membership is inactive (e.g. left org).';
    END IF;
    -- Extend role check to include posing_coach
    ALTER TABLE public.organisation_members DROP CONSTRAINT IF EXISTS organisation_members_role_check;
    ALTER TABLE public.organisation_members DROP CONSTRAINT IF EXISTS organisation_members_role_check1;
    ALTER TABLE public.organisation_members ADD CONSTRAINT organisation_members_role_check
      CHECK (role IN ('owner', 'admin', 'coach', 'assistant', 'posing_coach'));
  ELSE
    CREATE TABLE public.organisation_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
      profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'coach', 'assistant', 'posing_coach')),
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    COMMENT ON TABLE public.organisation_members IS 'Membership of a profile in an organisation; roles: owner, admin, coach, assistant, posing_coach.';
    COMMENT ON COLUMN public.organisation_members.role IS 'owner | admin | coach | assistant | posing_coach';
    COMMENT ON COLUMN public.organisation_members.is_active IS 'When false, membership is inactive.';
    ALTER TABLE public.organisation_members ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- One active membership per profile per organisation (partial unique index)
DROP INDEX IF EXISTS public.organisation_members_one_active_per_org_profile;
CREATE UNIQUE INDEX organisation_members_one_active_per_org_profile
  ON public.organisation_members (organisation_id, profile_id)
  WHERE is_active = true;

-- If table had simple UNIQUE(organisation_id, profile_id), we now allow multiple rows (e.g. re-join) but only one active
-- So drop the simple unique if it exists (optional; only if we want to allow re-joins)
-- ALTER TABLE public.organisation_members DROP CONSTRAINT IF EXISTS organisation_members_organisation_id_profile_id_key;

-- Requested indexes (create if not exist)
CREATE INDEX IF NOT EXISTS organisation_members_org_idx ON public.organisation_members(organisation_id);
CREATE INDEX IF NOT EXISTS organisation_members_profile_idx ON public.organisation_members(profile_id);

-- Update organisation_invites and clients RLS to use owner_profile_id where applicable
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organisations' AND column_name = 'owner_profile_id') THEN
    -- organisation_invites policies reference o.owner_id
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organisation_invites') THEN
      DROP POLICY IF EXISTS organisation_invites_select_org_admin ON public.organisation_invites;
      CREATE POLICY organisation_invites_select_org_admin ON public.organisation_invites
        FOR SELECT USING (
          EXISTS (SELECT 1 FROM public.organisations o WHERE o.id = organisation_id AND o.owner_profile_id = auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.organisation_members m
            WHERE m.organisation_id = organisation_invites.organisation_id AND m.profile_id = auth.uid() AND m.role IN ('owner', 'admin')
          )
        );
      DROP POLICY IF EXISTS organisation_invites_insert_org_admin ON public.organisation_invites;
      CREATE POLICY organisation_invites_insert_org_admin ON public.organisation_invites
        FOR INSERT WITH CHECK (
          EXISTS (SELECT 1 FROM public.organisations o WHERE o.id = organisation_id AND o.owner_profile_id = auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.organisation_members m
            WHERE m.organisation_id = organisation_invites.organisation_id AND m.profile_id = auth.uid() AND m.role IN ('owner', 'admin')
          )
        );
      DROP POLICY IF EXISTS organisation_invites_delete_org_admin ON public.organisation_invites;
      CREATE POLICY organisation_invites_delete_org_admin ON public.organisation_invites
        FOR DELETE USING (
          EXISTS (SELECT 1 FROM public.organisations o WHERE o.id = organisation_id AND o.owner_profile_id = auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.organisation_members m
            WHERE m.organisation_id = organisation_invites.organisation_id AND m.profile_id = auth.uid() AND m.role IN ('owner', 'admin')
          )
        );
    END IF;
    -- clients and checkins policies that reference organisations.owner_id
    DROP POLICY IF EXISTS clients_select_org_member ON public.clients;
    CREATE POLICY clients_select_org_member ON public.clients
      FOR SELECT USING (
        organisation_id IS NOT NULL
        AND (
          organisation_id IN (SELECT organisation_id FROM public.organisation_members WHERE profile_id = auth.uid())
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
              c.organisation_id IN (SELECT organisation_id FROM public.organisation_members WHERE profile_id = auth.uid())
              OR c.organisation_id IN (SELECT id FROM public.organisations WHERE owner_profile_id = auth.uid())
            )
        )
      );
  END IF;
END $$;

-- organisation_members INSERT policy (organisation_id in WITH CHECK is the new row's value)
DROP POLICY IF EXISTS organisation_members_insert ON public.organisation_members;
CREATE POLICY organisation_members_insert ON public.organisation_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.organisations o WHERE o.id = organisation_id AND o.owner_profile_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organisation_members m2
      WHERE m2.organisation_id = organisation_id AND m2.profile_id = auth.uid() AND m2.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS organisation_members_select ON public.organisation_members;
CREATE POLICY organisation_members_select ON public.organisation_members
  FOR SELECT USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organisation_members m2
      WHERE m2.organisation_id = organisation_members.organisation_id AND m2.profile_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.organisations o WHERE o.id = organisation_members.organisation_id AND o.owner_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS organisation_members_update ON public.organisation_members;
CREATE POLICY organisation_members_update ON public.organisation_members
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.organisations o WHERE o.id = organisation_id AND o.owner_profile_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organisation_members m2
      WHERE m2.organisation_id = organisation_members.organisation_id AND m2.profile_id = auth.uid() AND m2.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS organisation_members_delete ON public.organisation_members;
CREATE POLICY organisation_members_delete ON public.organisation_members
  FOR DELETE USING (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.organisations o WHERE o.id = organisation_id AND o.owner_profile_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organisation_members m2
      WHERE m2.organisation_id = organisation_members.organisation_id AND m2.profile_id = auth.uid() AND m2.role IN ('owner', 'admin')
    )
  );

-- =============================================================================
-- Schema summary
-- =============================================================================
-- public.organisations:
--   id                  uuid PK default gen_random_uuid()
--   name                text not null
--   slug                text unique (nullable; for URL-friendly identifier)
--   owner_profile_id    uuid not null references public.profiles(id) on delete restrict
--   created_at          timestamptz not null default now()
--   updated_at          timestamptz not null default now()
--   Index: organisations_slug_key (unique where slug is not null), idx_organisations_owner_id (owner_profile_id)
--
-- public.organisation_members:
--   id                  uuid PK default gen_random_uuid()
--   organisation_id     uuid not null references public.organisations(id) on delete cascade
--   profile_id          uuid not null references public.profiles(id) on delete cascade
--   role                text not null check (owner, admin, coach, assistant, posing_coach)
--   is_active           boolean not null default true
--   created_at          timestamptz not null default now()
--   Unique: one active membership per (organisation_id, profile_id) via partial index WHERE is_active = true
--   Indexes: organisation_members_org_idx (organisation_id), organisation_members_profile_idx (profile_id)
