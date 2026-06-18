-- Restore covering indexes for all foreign keys in public schema.
--
-- This migration intentionally uses index names that do NOT end with `_fk`
-- and do NOT start with `idx_fk_` so they are not affected by prior
-- cleanup migrations that targeted those naming patterns.

DO $$
DECLARE
  r RECORD;
  v_columns_sql text;
  v_index_name text;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      cls.relname AS table_name,
      c.conname AS constraint_name,
      c.conrelid AS table_oid,
      c.conkey AS fk_attnums
    FROM pg_constraint c
    JOIN pg_class cls ON cls.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cls.relnamespace
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_index i
        WHERE i.indrelid = c.conrelid
          AND i.indisvalid
          AND i.indpred IS NULL
          AND i.indnkeyatts >= COALESCE(array_length(c.conkey, 1), 0)
          AND (
            SELECT bool_and(i.indkey[s] = c.conkey[s])
            FROM generate_subscripts(c.conkey, 1) AS s
          )
      )
  LOOP
    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY k.ord)
    INTO v_columns_sql
    FROM unnest(r.fk_attnums) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a
      ON a.attrelid = r.table_oid
     AND a.attnum = k.attnum;

    IF v_columns_sql IS NULL OR btrim(v_columns_sql) = '' THEN
      CONTINUE;
    END IF;

    v_index_name := format(
      'idx_fkcov_%s_%s',
      left(r.table_name, 30),
      left(md5(r.constraint_name), 12)
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (%s)',
      v_index_name,
      r.schema_name,
      r.table_name,
      v_columns_sql
    );
  END LOOP;
END $$;
