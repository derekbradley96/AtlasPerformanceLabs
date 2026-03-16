-- RLS hardening pass: ensure every exposed public table has RLS and correct policies.
-- Atlas roles: coach, client, personal, admin. Ownership-based policies; minimal admin bypass.
-- Centralizes coach ownership (trainer_id compatibility) in one helper. No policy recursion.

-- =============================================================================
-- 1) HELPER: coach ownership of client (centralizes coach_id/trainer_id compatibility)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.current_user_owns_client(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = p_client_id
      AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid())
  );
$$;

COMMENT ON FUNCTION public.current_user_owns_client(uuid) IS
  'Returns true if the current user is the coach (coach_id or trainer_id) for the given client. Used in RLS to centralize legacy trainer_id compatibility.';

-- =============================================================================
-- 2) PROFILES: enable RLS and add ownership policies (admin select already exists)
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- Ensure admin policy uses helper (already done in fix_profiles_rls_recursion; no-op if present)
-- No INSERT: profiles are created by trigger from auth.users. No DELETE for users.

-- Clients table: ensure client (athlete) can read own row by user_id (coach/org/admin already have select elsewhere)
DROP POLICY IF EXISTS clients_select_client_own ON public.clients;
CREATE POLICY clients_select_client_own ON public.clients
  FOR SELECT USING (user_id = auth.uid());

-- =============================================================================
-- 3) SECURITY_AUDIT_LOGS: use current_user_is_admin() instead of inline profiles read
-- =============================================================================

DROP POLICY IF EXISTS security_audit_logs_select_admin ON public.security_audit_logs;
CREATE POLICY security_audit_logs_select_admin ON public.security_audit_logs
  FOR SELECT USING (public.current_user_is_admin());

-- =============================================================================
-- 4) BETA_FEEDBACK: use current_user_is_admin() (avoid inline profiles read)
-- =============================================================================

DROP POLICY IF EXISTS beta_feedback_select_is_admin ON public.beta_feedback;
CREATE POLICY beta_feedback_select_is_admin ON public.beta_feedback
  FOR SELECT USING (public.current_user_is_admin());

DROP POLICY IF EXISTS beta_feedback_update_is_admin ON public.beta_feedback;
CREATE POLICY beta_feedback_update_is_admin ON public.beta_feedback
  FOR UPDATE USING (public.current_user_is_admin());

-- =============================================================================
-- 5) NOTIFICATION_PREFERENCES: add DELETE for own row (full CRUD for own profile)
-- =============================================================================

DROP POLICY IF EXISTS notification_preferences_delete_own ON public.notification_preferences;
CREATE POLICY notification_preferences_delete_own ON public.notification_preferences
  FOR DELETE USING (profile_id = auth.uid());

-- =============================================================================
-- 6) ATLAS_* TABLES: enable RLS and coach-ownership policies
--    (atlas_coaches keys by user_id TEXT = auth.uid()::text; skip if tables absent)
-- =============================================================================

ALTER TABLE public.atlas_coaches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS atlas_coaches_select_own ON public.atlas_coaches;
CREATE POLICY atlas_coaches_select_own ON public.atlas_coaches
  FOR SELECT USING (user_id = (auth.uid())::text);

DROP POLICY IF EXISTS atlas_coaches_insert_own ON public.atlas_coaches;
CREATE POLICY atlas_coaches_insert_own ON public.atlas_coaches
  FOR INSERT WITH CHECK (user_id = (auth.uid())::text);

DROP POLICY IF EXISTS atlas_coaches_update_own ON public.atlas_coaches;
CREATE POLICY atlas_coaches_update_own ON public.atlas_coaches
  FOR UPDATE USING (user_id = (auth.uid())::text);

-- atlas_services: coach_id = current user's atlas_coaches.id
ALTER TABLE public.atlas_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS atlas_services_select_coach ON public.atlas_services;
CREATE POLICY atlas_services_select_coach ON public.atlas_services
  FOR SELECT USING (
    coach_id IN (SELECT id FROM public.atlas_coaches WHERE user_id = (auth.uid())::text)
  );
DROP POLICY IF EXISTS atlas_services_insert_coach ON public.atlas_services;
CREATE POLICY atlas_services_insert_coach ON public.atlas_services
  FOR INSERT WITH CHECK (
    coach_id IN (SELECT id FROM public.atlas_coaches WHERE user_id = (auth.uid())::text)
  );
DROP POLICY IF EXISTS atlas_services_update_coach ON public.atlas_services;
CREATE POLICY atlas_services_update_coach ON public.atlas_services
  FOR UPDATE USING (
    coach_id IN (SELECT id FROM public.atlas_coaches WHERE user_id = (auth.uid())::text)
  );
DROP POLICY IF EXISTS atlas_services_delete_coach ON public.atlas_services;
CREATE POLICY atlas_services_delete_coach ON public.atlas_services
  FOR DELETE USING (
    coach_id IN (SELECT id FROM public.atlas_coaches WHERE user_id = (auth.uid())::text)
  );

-- atlas_leads
ALTER TABLE public.atlas_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS atlas_leads_select_coach ON public.atlas_leads;
CREATE POLICY atlas_leads_select_coach ON public.atlas_leads
  FOR SELECT USING (
    coach_id IN (SELECT id FROM public.atlas_coaches WHERE user_id = (auth.uid())::text)
  );
DROP POLICY IF EXISTS atlas_leads_insert_coach ON public.atlas_leads;
CREATE POLICY atlas_leads_insert_coach ON public.atlas_leads
  FOR INSERT WITH CHECK (
    coach_id IN (SELECT id FROM public.atlas_coaches WHERE user_id = (auth.uid())::text)
  );
DROP POLICY IF EXISTS atlas_leads_update_coach ON public.atlas_leads;
CREATE POLICY atlas_leads_update_coach ON public.atlas_leads
  FOR UPDATE USING (
    coach_id IN (SELECT id FROM public.atlas_coaches WHERE user_id = (auth.uid())::text)
  );
DROP POLICY IF EXISTS atlas_leads_delete_coach ON public.atlas_leads;
CREATE POLICY atlas_leads_delete_coach ON public.atlas_leads
  FOR DELETE USING (
    coach_id IN (SELECT id FROM public.atlas_coaches WHERE user_id = (auth.uid())::text)
  );

-- atlas_clients
ALTER TABLE public.atlas_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS atlas_clients_select_coach ON public.atlas_clients;
CREATE POLICY atlas_clients_select_coach ON public.atlas_clients
  FOR SELECT USING (
    coach_id IN (SELECT id FROM public.atlas_coaches WHERE user_id = (auth.uid())::text)
  );
DROP POLICY IF EXISTS atlas_clients_insert_coach ON public.atlas_clients;
CREATE POLICY atlas_clients_insert_coach ON public.atlas_clients
  FOR INSERT WITH CHECK (
    coach_id IN (SELECT id FROM public.atlas_coaches WHERE user_id = (auth.uid())::text)
  );
DROP POLICY IF EXISTS atlas_clients_update_coach ON public.atlas_clients;
CREATE POLICY atlas_clients_update_coach ON public.atlas_clients
  FOR UPDATE USING (
    coach_id IN (SELECT id FROM public.atlas_coaches WHERE user_id = (auth.uid())::text)
  );
DROP POLICY IF EXISTS atlas_clients_delete_coach ON public.atlas_clients;
CREATE POLICY atlas_clients_delete_coach ON public.atlas_clients
  FOR DELETE USING (
    coach_id IN (SELECT id FROM public.atlas_coaches WHERE user_id = (auth.uid())::text)
  );

-- atlas_payments
ALTER TABLE public.atlas_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS atlas_payments_select_coach ON public.atlas_payments;
CREATE POLICY atlas_payments_select_coach ON public.atlas_payments
  FOR SELECT USING (
    coach_id IN (SELECT id FROM public.atlas_coaches WHERE user_id = (auth.uid())::text)
  );
DROP POLICY IF EXISTS atlas_payments_insert_coach ON public.atlas_payments;
CREATE POLICY atlas_payments_insert_coach ON public.atlas_payments
  FOR INSERT WITH CHECK (
    coach_id IN (SELECT id FROM public.atlas_coaches WHERE user_id = (auth.uid())::text)
  );
DROP POLICY IF EXISTS atlas_payments_update_coach ON public.atlas_payments;
CREATE POLICY atlas_payments_update_coach ON public.atlas_payments
  FOR UPDATE USING (
    coach_id IN (SELECT id FROM public.atlas_coaches WHERE user_id = (auth.uid())::text)
  );
DROP POLICY IF EXISTS atlas_payments_delete_coach ON public.atlas_payments;
CREATE POLICY atlas_payments_delete_coach ON public.atlas_payments
  FOR DELETE USING (
    coach_id IN (SELECT id FROM public.atlas_coaches WHERE user_id = (auth.uid())::text)
  );

-- atlas_review_items
ALTER TABLE public.atlas_review_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS atlas_review_items_select_coach ON public.atlas_review_items;
CREATE POLICY atlas_review_items_select_coach ON public.atlas_review_items
  FOR SELECT USING (
    coach_id IN (SELECT id FROM public.atlas_coaches WHERE user_id = (auth.uid())::text)
  );
DROP POLICY IF EXISTS atlas_review_items_insert_coach ON public.atlas_review_items;
CREATE POLICY atlas_review_items_insert_coach ON public.atlas_review_items
  FOR INSERT WITH CHECK (
    coach_id IN (SELECT id FROM public.atlas_coaches WHERE user_id = (auth.uid())::text)
  );
DROP POLICY IF EXISTS atlas_review_items_update_coach ON public.atlas_review_items;
CREATE POLICY atlas_review_items_update_coach ON public.atlas_review_items
  FOR UPDATE USING (
    coach_id IN (SELECT id FROM public.atlas_coaches WHERE user_id = (auth.uid())::text)
  );
DROP POLICY IF EXISTS atlas_review_items_delete_coach ON public.atlas_review_items;
CREATE POLICY atlas_review_items_delete_coach ON public.atlas_review_items
  FOR DELETE USING (
    coach_id IN (SELECT id FROM public.atlas_coaches WHERE user_id = (auth.uid())::text)
  );

-- =============================================================================
-- 7) INDEXES for columns heavily used in RLS predicates
-- =============================================================================

-- clients: coach_id and trainer_id already indexed; organisation_id already has clients_organisation_id_idx
CREATE INDEX IF NOT EXISTS clients_user_id_idx ON public.clients(user_id) WHERE user_id IS NOT NULL;

-- notifications and device_tokens: profile_id (notifications has notifications_profile_idx; device_tokens may not)
CREATE INDEX IF NOT EXISTS device_tokens_profile_id_idx ON public.device_tokens(profile_id);

-- organisation_members already has organisation_members_org_idx, organisation_members_profile_idx
-- No new indexes required for atlas_* (coach_id already indexed per table).
