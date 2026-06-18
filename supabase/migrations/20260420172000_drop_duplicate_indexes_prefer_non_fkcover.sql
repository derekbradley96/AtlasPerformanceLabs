-- Remove duplicate indexes in public schema, preferring non-generated names.
-- If duplicate definitions exist, keep one and drop the rest.
-- Priority kept first:
--   1) non-idx_fkcover_* / non-idx_fkkeep_*
--   2) idx_fkkeep_*
--   3) idx_fkcover_*

DO $$
DECLARE
  grp RECORD;
  idx RECORD;
BEGIN
  FOR grp IN
    WITH index_groups AS (
      SELECT
        schemaname,
        tablename,
        indexdef,
        array_agg(indexname ORDER BY indexname) AS indexes
      FROM pg_indexes
      WHERE schemaname = 'public'
      GROUP BY schemaname, tablename, indexdef
      HAVING count(*) > 1
    ),
    ranked AS (
      SELECT
        g.schemaname,
        g.tablename,
        g.indexdef,
        i.indexname,
        row_number() OVER (
          PARTITION BY g.schemaname, g.tablename, g.indexdef
          ORDER BY
            CASE
              WHEN i.indexname LIKE 'idx_fkcover_%' THEN 3
              WHEN i.indexname LIKE 'idx_fkkeep_%' THEN 2
              ELSE 1
            END,
            i.indexname
        ) AS keep_rank
      FROM index_groups g
      CROSS JOIN LATERAL unnest(g.indexes) AS i(indexname)
    )
    SELECT schemaname, indexname
    FROM ranked
    WHERE keep_rank > 1
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I.%I', grp.schemaname, grp.indexname);
  END LOOP;
END $$;
