-- Drops currently-unused FK-named indexes to reduce Supabase unused_index noise.
--
-- Scope:
-- - public schema only
-- - idx_scan = 0 in pg_stat_user_indexes
-- - index name matches generated FK naming patterns:
--   - idx_fk_*
--   - *_fk
--
-- Safety:
-- - Skip primary/unique/constraint-backed indexes.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      i.relname AS index_name
    FROM pg_stat_user_indexes sui
    JOIN pg_class i ON i.oid = sui.indexrelid
    JOIN pg_class t ON t.oid = sui.relid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_index ix ON ix.indexrelid = i.oid
    LEFT JOIN pg_constraint c ON c.conindid = i.oid
    WHERE n.nspname = 'public'
      AND sui.idx_scan = 0
      AND ix.indisvalid
      AND NOT ix.indisprimary
      AND NOT ix.indisunique
      AND c.oid IS NULL
      AND (
        i.relname LIKE 'idx_fk_%'
        OR i.relname LIKE '%\_fk' ESCAPE '\'
      )
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I.%I', r.schema_name, r.index_name);
  END LOOP;
END $$;
