-- Performance Advisor: merge ALL overlapping permissive RLS policies on public tables.
--
-- Supabase lint "multiple_permissive_policies" fires once per (table, cmd, role) when
-- more than one permissive policy applies. Multiple permissive policies are OR'd; one
-- policy with (expr1 OR expr2 OR ...) is equivalent, so we collapse each group.
--
-- Also rewrites bare auth.uid() → (SELECT auth.uid()) inside merged expressions to
-- reduce auth_rls_initplan warnings (without double-wrapping existing selects).
--
-- Prerequisites: run 20260415120000 first so policies use explicit TO roles where intended.
-- Skips: restrictive policies, non-public tables, non-ordinary tables.
--
-- Limitation: groups only policies that share the exact same TO role list (roles_key).
-- If one policy is TO authenticated and another is TO anon, authenticated, both still
-- apply to logged-in users; the linter counts that as multiple permissive policies for
-- role "authenticated", but this migration will NOT merge those (different groups).
-- Fixing that requires per-table merges or normalizing those policies to one TO clause.

CREATE OR REPLACE FUNCTION public._atlas_pa_wrap_auth_uid(txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT replace(
    replace(
      replace(coalesce($1, ''), '(SELECT auth.uid())', E'\x01AUTH_UID_MARK'),
      'auth.uid()',
      '(SELECT auth.uid())'
    ),
    E'\x01AUTH_UID_MARK',
    '(SELECT auth.uid())'
  );
$$;

DO $$
DECLARE
  g RECORD;
  pol RECORD;
  role_list text;
  roles_sql text;
  new_name text;
  using_parts text[] := ARRAY[]::text[];
  check_parts text[] := ARRAY[]::text[];
  merged_using text;
  merged_check text;
  uexpr text;
  wexpr text;
  cmd_sql text;
  stmt text;
BEGIN
  FOR g IN
    WITH base AS (
      SELECT
        c.oid AS relid,
        n.nspname AS schema_name,
        c.relname AS table_name,
        p.polname,
        p.polcmd,
        COALESCE(p.polroles, ARRAY[]::oid[]) AS role_oids,
        p.polpermissive,
        pg_get_expr(p.polqual, p.polrelid) AS qual_txt,
        pg_get_expr(p.polwithcheck, p.polrelid) AS with_txt
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p')
        AND p.polpermissive
    ),
    keyed AS (
      SELECT
        relid,
        schema_name,
        table_name,
        polcmd,
        COALESCE(
          (
            SELECT string_agg(r.rolname::text, ', ' ORDER BY r.rolname)
            FROM unnest(role_oids) AS ro(oid)
            JOIN pg_roles r ON r.oid = ro.oid
          ),
          ''
        ) AS roles_key
      FROM base
    ),
    grp AS (
      SELECT
        relid,
        schema_name,
        table_name,
        polcmd,
        roles_key,
        count(*)::int AS cnt
      FROM keyed
      GROUP BY relid, schema_name, table_name, polcmd, roles_key
      HAVING count(*) > 1
    )
    SELECT * FROM grp
    ORDER BY schema_name, table_name, polcmd
  LOOP
    using_parts := ARRAY[]::text[];
    check_parts := ARRAY[]::text[];

    IF g.roles_key = '' THEN
      role_list := '';
      roles_sql := '';
    ELSE
      role_list := g.roles_key;
      roles_sql := ' TO ' || (
        SELECT string_agg(quote_ident(trim(x)), ', ')
        FROM unnest(string_to_array(g.roles_key, ',')) AS t(x)
      );
    END IF;

    new_name := 'pa_mg_' || substr(md5(g.relid::text || g.polcmd::text || coalesce(g.roles_key, '')), 1, 24);

    FOR pol IN
      SELECT polname, polcmd, qual_txt, with_txt
      FROM (
        SELECT
          p.polname,
          p.polcmd,
          pg_get_expr(p.polqual, p.polrelid) AS qual_txt,
          pg_get_expr(p.polwithcheck, p.polrelid) AS with_txt,
          COALESCE(
            (
              SELECT string_agg(r.rolname::text, ', ' ORDER BY r.rolname)
              FROM unnest(COALESCE(p.polroles, ARRAY[]::oid[])) AS ro(oid)
              JOIN pg_roles r ON r.oid = ro.oid
            ),
            ''
          ) AS rk
        FROM pg_policy p
        WHERE p.polrelid = g.relid
          AND p.polcmd = g.polcmd
          AND p.polpermissive
      ) z
      WHERE z.rk = g.roles_key
    LOOP
      uexpr := nullif(trim(coalesce(pol.qual_txt, '')), '');
      wexpr := nullif(trim(coalesce(pol.with_txt, '')), '');

      IF g.polcmd = 'r' THEN
        using_parts := array_append(
          using_parts,
          '(' || public._atlas_pa_wrap_auth_uid(coalesce(uexpr, 'true')) || ')'
        );
      ELSIF g.polcmd = 'd' THEN
        using_parts := array_append(
          using_parts,
          '(' || public._atlas_pa_wrap_auth_uid(coalesce(uexpr, 'true')) || ')'
        );
      ELSIF g.polcmd = 'a' THEN
        check_parts := array_append(
          check_parts,
          '(' || public._atlas_pa_wrap_auth_uid(coalesce(wexpr, 'true')) || ')'
        );
      ELSIF g.polcmd = 'w' THEN
        using_parts := array_append(
          using_parts,
          '(' || public._atlas_pa_wrap_auth_uid(coalesce(uexpr, 'true')) || ')'
        );
        check_parts := array_append(
          check_parts,
          '(' || public._atlas_pa_wrap_auth_uid(coalesce(wexpr, uexpr, 'true')) || ')'
        );
      ELSIF g.polcmd = '*' THEN
        using_parts := array_append(
          using_parts,
          '(' || public._atlas_pa_wrap_auth_uid(coalesce(uexpr, 'true')) || ')'
        );
        check_parts := array_append(
          check_parts,
          '(' || public._atlas_pa_wrap_auth_uid(coalesce(wexpr, uexpr, 'true')) || ')'
        );
      ELSE
        RAISE NOTICE 'atlas_pa_merge_rls: skip unknown polcmd % on %', g.polcmd, g.table_name;
        using_parts := ARRAY[]::text[];
        check_parts := ARRAY[]::text[];
        EXIT;
      END IF;
    END LOOP;

    IF cardinality(using_parts) = 0 AND cardinality(check_parts) = 0 THEN
      CONTINUE;
    END IF;

    merged_using := coalesce(nullif(array_to_string(using_parts, ' OR '), ''), 'true');
    merged_check := coalesce(nullif(array_to_string(check_parts, ' OR '), ''), 'true');

    FOR pol IN
      SELECT p.polname
      FROM pg_policy p
      WHERE p.polrelid = g.relid
        AND p.polcmd = g.polcmd
        AND p.polpermissive
        AND COALESCE(
          (
            SELECT string_agg(r.rolname::text, ', ' ORDER BY r.rolname)
            FROM unnest(COALESCE(p.polroles, ARRAY[]::oid[])) AS ro(oid)
            JOIN pg_roles r ON r.oid = ro.oid
          ),
          ''
        ) = g.roles_key
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.polname, g.schema_name, g.table_name);
    END LOOP;

    -- Clause order must be FOR ... then TO ... (not TO ... FOR ...). Expressions are
    -- concatenated (not passed as format %s) so modulo `%` and quotes in qual text
    -- cannot break format().
    IF g.polcmd = 'r' THEN
      cmd_sql := 'FOR SELECT';
      stmt :=
        format(
          'CREATE POLICY %I ON %I.%I %s%s USING (',
          new_name,
          g.schema_name,
          g.table_name,
          cmd_sql,
          roles_sql
        )
        || merged_using
        || ')';
    ELSIF g.polcmd = 'd' THEN
      cmd_sql := 'FOR DELETE';
      stmt :=
        format(
          'CREATE POLICY %I ON %I.%I %s%s USING (',
          new_name,
          g.schema_name,
          g.table_name,
          cmd_sql,
          roles_sql
        )
        || merged_using
        || ')';
    ELSIF g.polcmd = 'a' THEN
      cmd_sql := 'FOR INSERT';
      stmt :=
        format(
          'CREATE POLICY %I ON %I.%I %s%s WITH CHECK (',
          new_name,
          g.schema_name,
          g.table_name,
          cmd_sql,
          roles_sql
        )
        || merged_check
        || ')';
    ELSIF g.polcmd = 'w' THEN
      cmd_sql := 'FOR UPDATE';
      stmt :=
        format(
          'CREATE POLICY %I ON %I.%I %s%s USING (',
          new_name,
          g.schema_name,
          g.table_name,
          cmd_sql,
          roles_sql
        )
        || merged_using
        || ') WITH CHECK ('
        || merged_check
        || ')';
    ELSIF g.polcmd = '*' THEN
      cmd_sql := 'FOR ALL';
      stmt :=
        format(
          'CREATE POLICY %I ON %I.%I %s%s USING (',
          new_name,
          g.schema_name,
          g.table_name,
          cmd_sql,
          roles_sql
        )
        || merged_using
        || ') WITH CHECK ('
        || merged_check
        || ')';
    ELSE
      CONTINUE;
    END IF;

    EXECUTE stmt;

    RAISE NOTICE 'atlas_pa_merge_rls: merged % permissive policies → % on %.% polcmd=% roles=%',
      g.cnt,
      new_name,
      g.schema_name,
      g.table_name,
      g.polcmd,
      coalesce(nullif(g.roles_key, ''), 'PUBLIC');
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public._atlas_pa_wrap_auth_uid(text);
