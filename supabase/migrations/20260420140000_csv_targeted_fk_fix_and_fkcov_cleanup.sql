-- Targeted fix based on current exported Supabase lint CSV.
--
-- A) Add explicit covering indexes for the remaining unindexed FK constraints.
-- B) Remove unused generated idx_fkcov_* indexes that are creating lint noise.

-- A) Explicit FK coverage for currently flagged constraints
CREATE INDEX IF NOT EXISTS idx_covfix_exercise_favorites_exercise_id
  ON public.exercise_favorites (exercise_id);

CREATE INDEX IF NOT EXISTS idx_covfix_exercise_substitutions_substitute_exercise_id
  ON public.exercise_substitutions (substitute_exercise_id);

CREATE INDEX IF NOT EXISTS idx_covfix_group_room_members_user_id
  ON public.group_room_members (user_id);

CREATE INDEX IF NOT EXISTS idx_covfix_organisation_members_profile_id
  ON public.organisation_members (profile_id);

CREATE INDEX IF NOT EXISTS idx_covfix_peak_week_day_status_client_id
  ON public.peak_week_day_status (client_id);

CREATE INDEX IF NOT EXISTS idx_covfix_review_queue_dismissals_client_id
  ON public.review_queue_dismissals (client_id);

-- B) Drop unused generated fkcov indexes
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
      AND i.relname LIKE 'idx_fkcov_%'
      AND sui.idx_scan = 0
      AND ix.indisvalid
      AND NOT ix.indisprimary
      AND NOT ix.indisunique
      AND c.oid IS NULL
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I.%I', r.schema_name, r.index_name);
  END LOOP;
END $$;
