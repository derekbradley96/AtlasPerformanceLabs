-- Reset lint-driven index churn:
-- 1) Drop all generated idx_lintcov_* indexes.
-- 2) Recreate only the currently-missing FK covering indexes from latest report.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, i.relname AS index_name
    FROM pg_class i
    JOIN pg_index ix ON ix.indexrelid = i.oid
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    LEFT JOIN pg_constraint c ON c.conindid = i.oid
    WHERE n.nspname = 'public'
      AND i.relname LIKE 'idx_lintcov_%'
      AND NOT ix.indisprimary
      AND NOT ix.indisunique
      AND c.oid IS NULL
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I.%I', r.schema_name, r.index_name);
  END LOOP;
END $$;

-- Keep coverage for the remaining six FK constraints.
CREATE INDEX IF NOT EXISTS idx_fkkeep_exercise_favorites_exercise_id
  ON public.exercise_favorites (exercise_id);

CREATE INDEX IF NOT EXISTS idx_fkkeep_exercise_substitutions_substitute_exercise_id
  ON public.exercise_substitutions (substitute_exercise_id);

CREATE INDEX IF NOT EXISTS idx_fkkeep_group_room_members_user_id
  ON public.group_room_members (user_id);

CREATE INDEX IF NOT EXISTS idx_fkkeep_organisation_members_profile_id
  ON public.organisation_members (profile_id);

CREATE INDEX IF NOT EXISTS idx_fkkeep_peak_week_day_status_client_id
  ON public.peak_week_day_status (client_id);

CREATE INDEX IF NOT EXISTS idx_fkkeep_review_queue_dismissals_client_id
  ON public.review_queue_dismissals (client_id);
