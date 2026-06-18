-- Reconcile FK indexing after broad auto-indexing pass.
--
-- 1) Drop redundant auto-generated idx_fk_* indexes when another index on the same
--    table already covers the same leading key columns.
-- 2) Ensure currently-reported missing FK indexes exist with stable names.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      t.relname AS table_name,
      i.relname AS index_name,
      ix.indexrelid AS index_oid,
      ix.indrelid AS table_oid,
      ix.indkey AS indkey,
      ix.indnkeyatts AS indnkeyatts
    FROM pg_class i
    JOIN pg_index ix ON ix.indexrelid = i.oid
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    LEFT JOIN pg_constraint c ON c.conindid = i.oid
    WHERE n.nspname = 'public'
      AND i.relkind = 'i'
      AND i.relname LIKE 'idx_fk_%'
      AND ix.indisvalid
      AND NOT ix.indisprimary
      AND NOT ix.indisunique
      AND c.oid IS NULL
      AND EXISTS (
        SELECT 1
        FROM pg_index ix2
        JOIN pg_class i2 ON i2.oid = ix2.indexrelid
        LEFT JOIN pg_constraint c2 ON c2.conindid = i2.oid
        WHERE ix2.indrelid = ix.indrelid
          AND ix2.indexrelid <> ix.indexrelid
          AND ix2.indisvalid
          AND ix2.indpred IS NULL
          AND c2.oid IS NULL
          AND ix2.indnkeyatts >= ix.indnkeyatts
          AND (
            SELECT bool_and(ix2.indkey[s] = ix.indkey[s])
            FROM generate_series(0, ix.indnkeyatts - 1) AS s
          )
      )
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I.%I', r.schema_name, r.index_name);
  END LOOP;
END $$;

-- Ensure remaining FK indexes currently reported by advisor.
CREATE INDEX IF NOT EXISTS idx_exercise_favorites_exercise_id_fk
  ON public.exercise_favorites (exercise_id);

CREATE INDEX IF NOT EXISTS idx_exercise_substitutions_substitute_exercise_id_fk
  ON public.exercise_substitutions (substitute_exercise_id);

CREATE INDEX IF NOT EXISTS idx_group_room_members_user_id_fk
  ON public.group_room_members (user_id);

CREATE INDEX IF NOT EXISTS idx_organisation_members_profile_id_fk
  ON public.organisation_members (profile_id);

CREATE INDEX IF NOT EXISTS idx_peak_week_day_status_client_id_fk
  ON public.peak_week_day_status (client_id);

CREATE INDEX IF NOT EXISTS idx_review_queue_dismissals_client_id_fk
  ON public.review_queue_dismissals (client_id);
