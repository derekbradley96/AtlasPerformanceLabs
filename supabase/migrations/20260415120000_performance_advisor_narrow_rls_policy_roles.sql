-- Performance Advisor (splinter): multiple_permissive_policies
--
-- Many policies were created without TO <role>, so they apply to every DB role.
-- Supabase's linter then reports the same overlapping permissive policies once per
-- role (anon, authenticated, authenticator, dashboard_user, cli_login_postgres,
-- supabase_privileged_role), massively inflating warning counts.
--
-- 1) Merge obvious duplicate SELECT policies on user_feedback (same as bug_reports pattern).
-- 2) Narrow "applies to all roles" policies to authenticated, with explicit anon where
--    the product relies on the anon key (landing waitlist, referral tracking, public reads).
-- 3) Widen marketplace public listing to anon + authenticated (expression already safe
--    for anon: only is_public rows match when auth.uid() is null).

-- -----------------------------------------------------------------------------
-- user_feedback: one SELECT policy instead of own + admin
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS user_feedback_select_own ON public.user_feedback;
DROP POLICY IF EXISTS user_feedback_select_admin ON public.user_feedback;
DROP POLICY IF EXISTS user_feedback_select_visible ON public.user_feedback;

CREATE POLICY user_feedback_select_visible ON public.user_feedback
  FOR SELECT
  TO authenticated
  USING (
    profile_id = (SELECT auth.uid())
    OR COALESCE(
      (SELECT p.is_admin FROM public.profiles p WHERE p.id = (SELECT auth.uid())),
      false
    )
  );

-- -----------------------------------------------------------------------------
-- Narrow RLS policies that currently apply to all roles (polroles = {})
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  target_roles text;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      p.polname AS policy_name
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND COALESCE(cardinality(p.polroles), 0) = 0
    ORDER BY n.nspname, c.relname, p.polname
  LOOP
    -- Anonymous + authenticated (landing / tracking / public content)
    IF r.table_name = 'waitlist' AND r.policy_name = 'waitlist_insert_any' THEN
      target_roles := 'anon, authenticated';
    ELSIF r.table_name = 'coach_referral_events' AND r.policy_name = 'coach_referral_events_insert' THEN
      target_roles := 'anon, authenticated';
    ELSIF r.table_name = 'client_result_stories' AND r.policy_name = 'client_result_stories_select_public' THEN
      target_roles := 'anon, authenticated';
    ELSIF r.table_name = 'result_story_metrics' AND r.policy_name = 'result_story_metrics_select' THEN
      target_roles := 'anon, authenticated';
    ELSE
      target_roles := 'authenticated';
    END IF;

    EXECUTE format(
      'ALTER POLICY %I ON %I.%I TO %s',
      r.policy_name,
      r.schema_name,
      r.table_name,
      target_roles
    );
  END LOOP;
END $$;

-- Marketplace discovery: allow anon reads of public listings (same USING as authenticated).
ALTER POLICY coach_marketplace_profiles_select_public_or_own ON public.coach_marketplace_profiles
  TO anon, authenticated;
