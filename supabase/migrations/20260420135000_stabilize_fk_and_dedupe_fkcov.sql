-- Stabilize advisor output:
-- 1) Force-create indexes for FK constraints still reported as unindexed.
-- 2) Drop only redundant idx_fkcov_* indexes that have an equivalent
--    alternative index on the same table/leading key columns.

DO $$
DECLARE
  r RECORD;
  v_conrelid oid;
  v_conkey int2[];
  v_table_name text;
  v_schema_name text;
  v_cols_sql text;
  v_has_covering boolean;
  v_idx_name text;
BEGIN
  -- Force coverage for the constraints that keep reappearing.
  FOR r IN
    SELECT unnest(ARRAY[
      'exercise_favorites_exercise_id_fkey',
      'exercise_substitutions_substitute_exercise_id_fkey',
      'group_room_members_user_id_fkey',
      'organisation_members_profile_id_fkey',
      'peak_week_day_status_client_id_fkey',
      'review_queue_dismissals_client_id_fkey'
    ]) AS constraint_name
  LOOP
    SELECT
      c.conrelid,
      c.conkey,
      cls.relname,
      nsp.nspname
    INTO
      v_conrelid,
      v_conkey,
      v_table_name,
      v_schema_name
    FROM pg_constraint c
    JOIN pg_class cls ON cls.oid = c.conrelid
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    WHERE c.contype = 'f'
      AND c.conname = r.constraint_name
      AND nsp.nspname = 'public'
    LIMIT 1;

    IF v_conrelid IS NULL THEN
      CONTINUE;
    END IF;

    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY k.ord)
    INTO v_cols_sql
    FROM unnest(v_conkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a
      ON a.attrelid = v_conrelid
     AND a.attnum = k.attnum;

    SELECT EXISTS (
      SELECT 1
      FROM pg_index i
      WHERE i.indrelid = v_conrelid
        AND i.indisvalid
        AND i.indpred IS NULL
        AND i.indnkeyatts >= COALESCE(array_length(v_conkey, 1), 0)
        AND (
          SELECT bool_and(i.indkey[s] = v_conkey[s])
          FROM generate_subscripts(v_conkey, 1) AS s
        )
    )
    INTO v_has_covering;

    IF v_has_covering THEN
      CONTINUE;
    END IF;

    v_idx_name := format(
      'idx_cov_%s_%s',
      left(v_table_name, 30),
      left(md5(r.constraint_name), 12)
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (%s)',
      v_idx_name,
      v_schema_name,
      v_table_name,
      v_cols_sql
    );
  END LOOP;
END $$;

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Remove only redundant fkcov indexes (safe dedupe).
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
      AND i.relname LIKE 'idx_fkcov_%'
      AND sui.idx_scan = 0
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
