-- Security Advisor: duplicate indexes, RLS initplan (auth.* in policies), and a few
-- obvious duplicate permissive policies (same role + action, redundant OR paths).

-- -----------------------------------------------------------------------------
-- 1) duplicate_index — drop redundant indexes (keep the surviving name per pair)
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_checkins_client_id;
DROP INDEX IF EXISTS public.idx_habit_logs_habit;
DROP INDEX IF EXISTS public.idx_client_habits_client;
DROP INDEX IF EXISTS public.idx_clients_user_id;
DROP INDEX IF EXISTS public.contest_preps_active_unique;
DROP INDEX IF EXISTS public.device_tokens_profile_idx;
DROP INDEX IF EXISTS public.organisation_members_org_idx;
DROP INDEX IF EXISTS public.organisation_members_profile_idx;
DROP INDEX IF EXISTS public.peak_week_plan_unique;
DROP INDEX IF EXISTS public.pose_checks_week_unique;

-- UNIQUE index on coach_id already covers lookups on coach_id
DROP INDEX IF EXISTS public.coach_offers_coach_id_idx;
DROP INDEX IF EXISTS public.coach_marketplace_profiles_coach_id_idx;

-- -----------------------------------------------------------------------------
-- 2) multiple_permissive_policies — merge redundant parallel admin/staff policies
-- -----------------------------------------------------------------------------

-- beta_feedback: inbox list (beta_feedback_admins) OR platform admin (profiles)
DROP POLICY IF EXISTS beta_feedback_select_admin ON public.beta_feedback;
DROP POLICY IF EXISTS beta_feedback_select_is_admin ON public.beta_feedback;
CREATE POLICY beta_feedback_select_staff ON public.beta_feedback
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    public.current_user_is_admin()
    OR (SELECT auth.uid()) IN (SELECT a.user_id FROM public.beta_feedback_admins a)
  );

DROP POLICY IF EXISTS beta_feedback_update_admin ON public.beta_feedback;
DROP POLICY IF EXISTS beta_feedback_update_is_admin ON public.beta_feedback;
CREATE POLICY beta_feedback_update_staff ON public.beta_feedback
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    public.current_user_is_admin()
    OR (SELECT auth.uid()) IN (SELECT a.user_id FROM public.beta_feedback_admins a)
  )
  WITH CHECK (
    public.current_user_is_admin()
    OR (SELECT auth.uid()) IN (SELECT a.user_id FROM public.beta_feedback_admins a)
  );

-- bug_reports: reporter OR admin (single SELECT policy)
DROP POLICY IF EXISTS bug_reports_select_own ON public.bug_reports;
DROP POLICY IF EXISTS bug_reports_select_admin ON public.bug_reports;
CREATE POLICY bug_reports_select_visible ON public.bug_reports
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    reported_by = (SELECT auth.uid())
    OR public.current_user_is_admin()
  );

-- -----------------------------------------------------------------------------
-- 3) auth_rls_initplan — wrap auth.uid() / auth.jwt() in scalar subqueries (one initplan)
--    Rebuilds every policy on public tables/partitions whose expressions change.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.atlas_temp_rewrite_rls_auth_expr(expr text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
BEGIN
  IF expr IS NULL OR btrim(expr) = '' THEN
    RETURN NULL;
  END IF;
  expr := replace(expr, '(SELECT auth.uid())', '<<ATLAS_AUTH_UID>>');
  expr := replace(expr, '(select auth.uid())', '<<ATLAS_AUTH_UID>>');
  expr := replace(expr, '(SELECT auth.jwt())', '<<ATLAS_AUTH_JWT>>');
  expr := replace(expr, '(select auth.jwt())', '<<ATLAS_AUTH_JWT>>');
  expr := replace(expr, 'auth.uid()', '(select auth.uid())');
  expr := replace(expr, 'auth.jwt()', '(select auth.jwt())');
  expr := replace(expr, '<<ATLAS_AUTH_UID>>', '(select auth.uid())');
  expr := replace(expr, '<<ATLAS_AUTH_JWT>>', '(select auth.jwt())');
  RETURN expr;
END;
$fn$;

DO $rewrite$
DECLARE
  r RECORD;
  new_u text;
  new_w text;
  cmd_txt text;
  pol_kind text;
  role_clause text;
  stmt text;
BEGIN
  DROP TABLE IF EXISTS _atlas_rls_policy_snapshot;
  CREATE TEMP TABLE _atlas_rls_policy_snapshot ON COMMIT DROP AS
  SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    p.polname AS policy_name,
    p.polpermissive AS is_permissive,
    p.polcmd AS polcmd,
    pg_get_expr(p.polqual, p.polrelid) AS qual,
    pg_get_expr(p.polwithcheck, p.polrelid) AS with_chk,
    p.polroles AS role_oids
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE (n.nspname = 'public' AND c.relkind IN ('r', 'p'))
     OR (n.nspname = 'storage' AND c.relname = 'objects' AND c.relkind = 'r');

  FOR r IN SELECT * FROM _atlas_rls_policy_snapshot
  LOOP
    new_u := public.atlas_temp_rewrite_rls_auth_expr(r.qual);
    new_w := public.atlas_temp_rewrite_rls_auth_expr(r.with_chk);

    IF (new_u IS NOT DISTINCT FROM r.qual) AND (new_w IS NOT DISTINCT FROM r.with_chk) THEN
      CONTINUE;
    END IF;

    cmd_txt := CASE r.polcmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'a' THEN 'INSERT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      WHEN '*' THEN 'ALL'
      ELSE 'SELECT'
    END;

    pol_kind := CASE WHEN r.is_permissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END;

    IF r.role_oids IS NULL OR array_length(r.role_oids, 1) IS NULL THEN
      role_clause := '';
    ELSE
      SELECT string_agg(quote_ident(rolname), ', ' ORDER BY rolname)
      INTO role_clause
      FROM pg_roles
      WHERE oid = ANY (r.role_oids);
      role_clause := ' TO ' || role_clause;
    END IF;

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      r.policy_name,
      r.schema_name,
      r.table_name
    );

    stmt := format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s%s',
      r.policy_name,
      r.schema_name,
      r.table_name,
      pol_kind,
      cmd_txt,
      role_clause
    );

    IF new_u IS NOT NULL AND btrim(new_u) <> '' THEN
      stmt := stmt || ' USING (' || new_u || ')';
    END IF;

    IF new_w IS NOT NULL AND btrim(new_w) <> '' THEN
      stmt := stmt || ' WITH CHECK (' || new_w || ')';
    END IF;

    EXECUTE stmt;
  END LOOP;
END;
$rewrite$;

DROP FUNCTION IF EXISTS public.atlas_temp_rewrite_rls_auth_expr(text);

-- -----------------------------------------------------------------------------
-- 4) Helper used widely in RLS: align with initplan-friendly auth calls
-- -----------------------------------------------------------------------------
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
      AND (
        c.coach_id = (SELECT auth.uid())
        OR c.trainer_id = (SELECT auth.uid())
      )
  );
$$;

COMMENT ON FUNCTION public.current_user_owns_client(uuid) IS
  'Returns true if the current user is the coach (coach_id or trainer_id) for the given client. Used in RLS to centralize legacy trainer_id compatibility.';
