-- Drops indexes that currently register as unused in pg_stat_user_indexes.
-- This is an implementation of Supabase "unused_index" advisor suggestions.
--
-- Guardrails:
-- - Only public schema.
-- - Skip primary and unique indexes.
-- - Skip indexes backing constraints.
-- - Skip invalid indexes.
--
-- Note: pg_stat_user_indexes counters reset on PostgreSQL restart.
-- Re-run advisor and query workload if you want to validate with a longer window.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      cls.relname AS table_name,
      idxcls.relname AS index_name
    FROM pg_stat_user_indexes sui
    JOIN pg_class idxcls ON idxcls.oid = sui.indexrelid
    JOIN pg_class cls ON cls.oid = sui.relid
    JOIN pg_namespace n ON n.oid = cls.relnamespace
    JOIN pg_index i ON i.indexrelid = sui.indexrelid
    LEFT JOIN pg_constraint c ON c.conindid = sui.indexrelid
    WHERE n.nspname = 'public'
      AND sui.idx_scan = 0
      AND i.indisvalid
      AND NOT i.indisprimary
      AND NOT i.indisunique
      AND c.oid IS NULL
  LOOP
    EXECUTE format(
      'DROP INDEX IF EXISTS %I.%I',
      r.schema_name,
      r.index_name
    );
  END LOOP;
END $$;
