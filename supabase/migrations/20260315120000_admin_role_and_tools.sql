-- Admin role and admin tools: profiles.is_admin + index + RLS for platform-wide read.
-- Admins can view all organisations, coaches, clients, payments, and platform metrics.
-- No impersonation. Uses existing get_admin_dashboard / get_admin_users / get_admin_coaches / get_admin_metrics RPCs for metrics.

-- =============================================================================
-- 1) PROFILES: ensure is_admin column and standardise index name
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_admin IS 'Platform admin: can access /admin, view all orgs/coaches/clients/payments and platform metrics. No impersonation.';

-- Standardise index name to profiles_admin_idx (drop legacy name if present)
DROP INDEX IF EXISTS public.idx_profiles_is_admin;

CREATE INDEX IF NOT EXISTS profiles_admin_idx
  ON public.profiles(is_admin)
  WHERE is_admin = true;

-- =============================================================================
-- 2) RLS: allow admins to SELECT organisations, clients, payments, org members
-- =============================================================================

-- Helper: true when current user is a platform admin (used in policies)
-- (Policies use inline subquery for clarity and to avoid dependency on a function.)

-- Organisations: admin can view all
DROP POLICY IF EXISTS organisations_select_admin ON public.organisations;
CREATE POLICY organisations_select_admin ON public.organisations
  FOR SELECT
  USING (
    (SELECT COALESCE(p.is_admin, false) FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Organisation members: admin can view all (needed when listing orgs and their members)
DROP POLICY IF EXISTS organisation_members_select_admin ON public.organisation_members;
CREATE POLICY organisation_members_select_admin ON public.organisation_members
  FOR SELECT
  USING (
    (SELECT COALESCE(p.is_admin, false) FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Clients: admin can view all
DROP POLICY IF EXISTS clients_select_admin ON public.clients;
CREATE POLICY clients_select_admin ON public.clients
  FOR SELECT
  USING (
    (SELECT COALESCE(p.is_admin, false) FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Client payments: admin can view all
DROP POLICY IF EXISTS client_payments_select_admin ON public.client_payments;
CREATE POLICY client_payments_select_admin ON public.client_payments
  FOR SELECT
  USING (
    (SELECT COALESCE(p.is_admin, false) FROM public.profiles p WHERE p.id = auth.uid())
  );

-- =============================================================================
-- 3) Profiles: allow admins to SELECT all profiles (view all coaches/users)
-- =============================================================================
-- Only add policy if RLS is enabled on public.profiles (required for CREATE POLICY).
DO $$
BEGIN
  IF (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.profiles'::regclass) THEN
    DROP POLICY IF EXISTS profiles_select_admin ON public.profiles;
    CREATE POLICY profiles_select_admin ON public.profiles
      FOR SELECT
      USING (
        (SELECT COALESCE(p.is_admin, false) FROM public.profiles p WHERE p.id = auth.uid())
      );
  END IF;
END $$;
