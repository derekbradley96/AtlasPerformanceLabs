-- Correct duplicate-index cleanup using structural metadata (not indexdef text).
-- Keeps one index per duplicate signature and drops the rest.
-- Priority:
--   1) non-idx_fkcover_* / non-idx_fkkeep_*
--   2) idx_fkkeep_*
--   3) idx_fkcover_*
--
-- Safety:
-- - public schema only
-- - never drops primary/unique indexes
-- - never drops indexes backing constraints

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    WITH idx AS (
      SELECT
        n.nspname AS schemaname,
        t.relname AS tablename,
        i.relname AS indexname,
        ix.indexrelid,
        ix.indrelid,
        ix.indisunique,
        ix.indisprimary,
        am.amname,
        ix.indkey,
        ix.indclass,
        ix.indcollation,
        ix.indoption,
        pg_get_expr(ix.indexprs, ix.indrelid) AS indexprs_expr,
        pg_get_expr(ix.indpred, ix.indrelid) AS indpred_expr
      FROM pg_index ix
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_am am ON am.oid = i.relam
      WHERE n.nspname = 'public'
    ),
    dup_ranked AS (
      SELECT
        idx.*,
        row_number() OVER (
          PARTITION BY
            idx.indrelid,
            idx.amname,
            idx.indkey,
            idx.indclass,
            idx.indcollation,
            idx.indoption,
            coalesce(idx.indexprs_expr, ''),
            coalesce(idx.indpred_expr, ''),
            idx.indisunique,
            idx.indisprimary
          ORDER BY
            CASE
              WHEN idx.indexname LIKE 'idx_fkcover_%' THEN 3
              WHEN idx.indexname LIKE 'idx_fkkeep_%' THEN 2
              ELSE 1
            END,
            idx.indexname
        ) AS keep_rank,
        count(*) OVER (
          PARTITION BY
            idx.indrelid,
            idx.amname,
            idx.indkey,
            idx.indclass,
            idx.indcollation,
            idx.indoption,
            coalesce(idx.indexprs_expr, ''),
            coalesce(idx.indpred_expr, ''),
            idx.indisunique,
            idx.indisprimary
        ) AS dup_count
      FROM idx
      WHERE NOT idx.indisunique
        AND NOT idx.indisprimary
        AND NOT EXISTS (
          SELECT 1
          FROM pg_constraint c
          WHERE c.conindid = idx.indexrelid
        )
    )
    SELECT schemaname, indexname
    FROM dup_ranked
    WHERE dup_count > 1
      AND keep_rank > 1
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I.%I', r.schemaname, r.indexname);
  END LOOP;
END $$;
