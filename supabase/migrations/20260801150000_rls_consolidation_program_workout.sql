-- RLS consolidation: program_blocks / program_weeks / program_days /
-- program_exercises / workout_sessions / workout_session_sets.
--
-- Why: these tables accumulated 3-5 permissive policies per action across
-- 20250308120000, 20260320131000, 20260329180000, 20260420200000,
-- 20260424090000, 20260701100000 and 20260701110000. Postgres evaluates every
-- permissive policy for every row, and most of them used BARE auth.uid()
-- (re-evaluated per row — the auth_rls_initplan advisor issue that
-- 20260414120000 fixed elsewhere) plus COALESCE(coach_id, trainer_id)
-- predicates that defeat indexes. Combined with 2-3-table join subqueries,
-- this was the DB-side multiplier behind "canceling statement due to
-- statement timeout" during device testing.
--
-- What this does — ESTABLISHES the canonical policy set (one per action per
-- table) as the OR-union of every policy these tables have ever been given:
--   1. ONE policy per action per table.
--   2. auth.uid() always wrapped as (select auth.uid()) — initplan, not per row.
--   3. COALESCE(coach_id, trainer_id) = uid rewritten to its exact indexable
--      equivalent: coach_id = uid OR (coach_id IS NULL AND trainer_id = uid).
--   4. Missing index on program_blocks(coach_id) added (client_id and
--      owner_profile_id already have indexes).
--   5. Dynamic cleanup of leftover pa_mg_* merged policies: 20260415130400
--      merged multi-policy groups into pa_mg_<md5> policies and dropped the
--      originals, and 20260415140000's cleanup array OMITTED
--      workout_sessions — so a merged SELECT policy (with a per-row
--      SECURITY DEFINER current_user_owns_client call, plain-OR trainer
--      semantics) survives there on any chain-built database. Dropped here
--      across all six tables, defensively and idempotently.
--
-- IMPORTANT — environment-dependent baseline: because the 20260415 merges
-- created/dropped policies DYNAMICALLY, what is live right now depends on the
-- database's migration history. On a chain-HEAD database, several named
-- policies in the DROP list below no longer exist (their content was merged
-- into pa_mg_* and later dropped without recreation), which means some arms
-- re-created here — client SELECT on the program chain, personal-owner
-- select/insert arms — are RESTORATIONS of documented product access that had
-- gone dead at the DB layer, not mere restatements. That restoration is
-- intended. After applying, the policy set below is the single source of
-- truth regardless of prior history.
--
-- Access model preserved:
--   SELECT (program tables): personal owner, block coach, coach of the linked
--     client (incl. legacy trainer_id-only rows), the client themself, and a
--     coach reading the pre-link history of a personal user who became their
--     client (20260701110000).
--   INSERT/UPDATE/DELETE (program tables): personal owner and coach scopes
--     only — clients never write programs.
--   workout tables: the athlete (client or personal) owns reads+writes; the
--     coach of a linked client gets read-only.

-- -----------------------------------------------------------------------------
-- 0a) Index: program_blocks(coach_id) was the one policy-critical column
--     without an index (client_id, owner_profile_id, phase_id already covered).
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_program_blocks_coach_id ON public.program_blocks(coach_id);

-- -----------------------------------------------------------------------------
-- 0b) Drop any leftover pa_mg_* merged policies on the six tables (same
--     technique as 20260415140000 §7, whose array omitted the workout tables).
--     Idempotent: loop is a no-op where none exist.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS sc, c.relname AS tbl, p.polname
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY (
        ARRAY[
          'program_blocks',
          'program_weeks',
          'program_days',
          'program_exercises',
          'workout_sessions',
          'workout_session_sets'
        ]
      )
      AND p.polname ~ '^pa_mg_'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      r.polname,
      r.sc,
      r.tbl
    );
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 1) program_blocks
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS program_blocks_select ON public.program_blocks;
DROP POLICY IF EXISTS program_blocks_select_client ON public.program_blocks;
DROP POLICY IF EXISTS program_blocks_select_client_personal ON public.program_blocks;
DROP POLICY IF EXISTS program_blocks_select_coach_scope ON public.program_blocks;
DROP POLICY IF EXISTS program_blocks_select_personal_owner ON public.program_blocks;
DROP POLICY IF EXISTS program_blocks_insert ON public.program_blocks;
DROP POLICY IF EXISTS program_blocks_insert_coach_scope ON public.program_blocks;
DROP POLICY IF EXISTS program_blocks_insert_personal_owner ON public.program_blocks;
DROP POLICY IF EXISTS program_blocks_update ON public.program_blocks;
DROP POLICY IF EXISTS program_blocks_update_coach_scope ON public.program_blocks;
DROP POLICY IF EXISTS program_blocks_update_personal_owner ON public.program_blocks;
DROP POLICY IF EXISTS program_blocks_delete ON public.program_blocks;
DROP POLICY IF EXISTS program_blocks_delete_coach_scope ON public.program_blocks;
DROP POLICY IF EXISTS program_blocks_delete_personal_owner ON public.program_blocks;

CREATE POLICY program_blocks_select ON public.program_blocks
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    owner_profile_id = (select auth.uid())
    OR coach_id = (select auth.uid())
    OR client_id IN (
      SELECT c.id FROM public.clients c
      WHERE c.user_id = (select auth.uid())
         OR c.coach_id = (select auth.uid())
         OR (c.coach_id IS NULL AND c.trainer_id = (select auth.uid()))
    )
    -- Coach reading the pre-link personal history of a user who became their client
    OR owner_profile_id IN (
      SELECT c.user_id FROM public.clients c
      WHERE c.coach_id = (select auth.uid()) AND c.user_id IS NOT NULL
    )
  );

CREATE POLICY program_blocks_insert ON public.program_blocks
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    (owner_profile_id = (select auth.uid()) AND client_id IS NULL)
    OR coach_id = (select auth.uid())
    OR client_id IN (
      SELECT c.id FROM public.clients c WHERE c.coach_id = (select auth.uid())
    )
  );

CREATE POLICY program_blocks_update ON public.program_blocks
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    owner_profile_id = (select auth.uid())
    OR coach_id = (select auth.uid())
    OR client_id IN (
      SELECT c.id FROM public.clients c
      WHERE c.coach_id = (select auth.uid())
         OR (c.coach_id IS NULL AND c.trainer_id = (select auth.uid()))
    )
  )
  WITH CHECK (
    (owner_profile_id = (select auth.uid()) AND client_id IS NULL)
    OR coach_id = (select auth.uid())
    OR client_id IN (
      SELECT c.id FROM public.clients c
      WHERE c.coach_id = (select auth.uid())
         OR (c.coach_id IS NULL AND c.trainer_id = (select auth.uid()))
    )
  );

CREATE POLICY program_blocks_delete ON public.program_blocks
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    owner_profile_id = (select auth.uid())
    OR coach_id = (select auth.uid())
    OR client_id IN (
      SELECT c.id FROM public.clients c
      WHERE c.coach_id = (select auth.uid())
         OR (c.coach_id IS NULL AND c.trainer_id = (select auth.uid()))
    )
  );

-- -----------------------------------------------------------------------------
-- 2) program_weeks (access via parent block)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS program_weeks_select ON public.program_weeks;
DROP POLICY IF EXISTS program_weeks_select_client ON public.program_weeks;
DROP POLICY IF EXISTS program_weeks_select_client_personal ON public.program_weeks;
DROP POLICY IF EXISTS program_weeks_select_coach_scope ON public.program_weeks;
DROP POLICY IF EXISTS program_weeks_select_personal_owner ON public.program_weeks;
DROP POLICY IF EXISTS program_weeks_insert ON public.program_weeks;
DROP POLICY IF EXISTS program_weeks_insert_coach_scope ON public.program_weeks;
DROP POLICY IF EXISTS program_weeks_insert_personal_owner ON public.program_weeks;
DROP POLICY IF EXISTS program_weeks_update ON public.program_weeks;
DROP POLICY IF EXISTS program_weeks_update_coach_scope ON public.program_weeks;
DROP POLICY IF EXISTS program_weeks_update_personal_owner ON public.program_weeks;
DROP POLICY IF EXISTS program_weeks_delete ON public.program_weeks;
DROP POLICY IF EXISTS program_weeks_delete_coach_scope ON public.program_weeks;
DROP POLICY IF EXISTS program_weeks_delete_personal_owner ON public.program_weeks;

CREATE POLICY program_weeks_select ON public.program_weeks
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    block_id IN (
      SELECT pb.id FROM public.program_blocks pb
      WHERE pb.owner_profile_id = (select auth.uid())
         OR pb.coach_id = (select auth.uid())
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c
           WHERE c.user_id = (select auth.uid())
              OR c.coach_id = (select auth.uid())
              OR (c.coach_id IS NULL AND c.trainer_id = (select auth.uid()))
         )
         OR pb.owner_profile_id IN (
           SELECT c.user_id FROM public.clients c
           WHERE c.coach_id = (select auth.uid()) AND c.user_id IS NOT NULL
         )
    )
  );

CREATE POLICY program_weeks_insert ON public.program_weeks
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    block_id IN (
      SELECT pb.id FROM public.program_blocks pb
      WHERE pb.owner_profile_id = (select auth.uid())
         OR pb.coach_id = (select auth.uid())
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c
           WHERE c.coach_id = (select auth.uid())
              OR (c.coach_id IS NULL AND c.trainer_id = (select auth.uid()))
         )
    )
  );

CREATE POLICY program_weeks_update ON public.program_weeks
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    block_id IN (
      SELECT pb.id FROM public.program_blocks pb
      WHERE pb.owner_profile_id = (select auth.uid())
         OR pb.coach_id = (select auth.uid())
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c
           WHERE c.coach_id = (select auth.uid())
              OR (c.coach_id IS NULL AND c.trainer_id = (select auth.uid()))
         )
    )
  )
  WITH CHECK (
    block_id IN (
      SELECT pb.id FROM public.program_blocks pb
      WHERE pb.owner_profile_id = (select auth.uid())
         OR pb.coach_id = (select auth.uid())
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c
           WHERE c.coach_id = (select auth.uid())
              OR (c.coach_id IS NULL AND c.trainer_id = (select auth.uid()))
         )
    )
  );

CREATE POLICY program_weeks_delete ON public.program_weeks
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    block_id IN (
      SELECT pb.id FROM public.program_blocks pb
      WHERE pb.owner_profile_id = (select auth.uid())
         OR pb.coach_id = (select auth.uid())
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c
           WHERE c.coach_id = (select auth.uid())
              OR (c.coach_id IS NULL AND c.trainer_id = (select auth.uid()))
         )
    )
  );

-- -----------------------------------------------------------------------------
-- 3) program_days (access via week -> block)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS program_days_select ON public.program_days;
DROP POLICY IF EXISTS program_days_select_client ON public.program_days;
DROP POLICY IF EXISTS program_days_select_client_personal ON public.program_days;
DROP POLICY IF EXISTS program_days_select_coach_scope ON public.program_days;
DROP POLICY IF EXISTS program_days_select_personal_owner ON public.program_days;
DROP POLICY IF EXISTS program_days_insert ON public.program_days;
DROP POLICY IF EXISTS program_days_insert_coach_scope ON public.program_days;
DROP POLICY IF EXISTS program_days_insert_personal_owner ON public.program_days;
DROP POLICY IF EXISTS program_days_update ON public.program_days;
DROP POLICY IF EXISTS program_days_update_coach_scope ON public.program_days;
DROP POLICY IF EXISTS program_days_update_personal_owner ON public.program_days;
DROP POLICY IF EXISTS program_days_delete ON public.program_days;
DROP POLICY IF EXISTS program_days_delete_coach_scope ON public.program_days;
DROP POLICY IF EXISTS program_days_delete_personal_owner ON public.program_days;

CREATE POLICY program_days_select ON public.program_days
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    week_id IN (
      SELECT pw.id FROM public.program_weeks pw
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.owner_profile_id = (select auth.uid())
         OR pb.coach_id = (select auth.uid())
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c
           WHERE c.user_id = (select auth.uid())
              OR c.coach_id = (select auth.uid())
              OR (c.coach_id IS NULL AND c.trainer_id = (select auth.uid()))
         )
         OR pb.owner_profile_id IN (
           SELECT c.user_id FROM public.clients c
           WHERE c.coach_id = (select auth.uid()) AND c.user_id IS NOT NULL
         )
    )
  );

CREATE POLICY program_days_insert ON public.program_days
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    week_id IN (
      SELECT pw.id FROM public.program_weeks pw
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.owner_profile_id = (select auth.uid())
         OR pb.coach_id = (select auth.uid())
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c
           WHERE c.coach_id = (select auth.uid())
              OR (c.coach_id IS NULL AND c.trainer_id = (select auth.uid()))
         )
    )
  );

CREATE POLICY program_days_update ON public.program_days
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    week_id IN (
      SELECT pw.id FROM public.program_weeks pw
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.owner_profile_id = (select auth.uid())
         OR pb.coach_id = (select auth.uid())
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c
           WHERE c.coach_id = (select auth.uid())
              OR (c.coach_id IS NULL AND c.trainer_id = (select auth.uid()))
         )
    )
  )
  WITH CHECK (
    week_id IN (
      SELECT pw.id FROM public.program_weeks pw
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.owner_profile_id = (select auth.uid())
         OR pb.coach_id = (select auth.uid())
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c
           WHERE c.coach_id = (select auth.uid())
              OR (c.coach_id IS NULL AND c.trainer_id = (select auth.uid()))
         )
    )
  );

CREATE POLICY program_days_delete ON public.program_days
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    week_id IN (
      SELECT pw.id FROM public.program_weeks pw
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.owner_profile_id = (select auth.uid())
         OR pb.coach_id = (select auth.uid())
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c
           WHERE c.coach_id = (select auth.uid())
              OR (c.coach_id IS NULL AND c.trainer_id = (select auth.uid()))
         )
    )
  );

-- -----------------------------------------------------------------------------
-- 4) program_exercises (access via day -> week -> block)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS program_exercises_select ON public.program_exercises;
DROP POLICY IF EXISTS program_exercises_select_client ON public.program_exercises;
DROP POLICY IF EXISTS program_exercises_select_client_personal ON public.program_exercises;
DROP POLICY IF EXISTS program_exercises_select_coach_scope ON public.program_exercises;
DROP POLICY IF EXISTS program_exercises_select_personal_owner ON public.program_exercises;
DROP POLICY IF EXISTS program_exercises_insert ON public.program_exercises;
DROP POLICY IF EXISTS program_exercises_insert_coach_scope ON public.program_exercises;
DROP POLICY IF EXISTS program_exercises_insert_personal_owner ON public.program_exercises;
DROP POLICY IF EXISTS program_exercises_update ON public.program_exercises;
DROP POLICY IF EXISTS program_exercises_update_coach ON public.program_exercises;
DROP POLICY IF EXISTS program_exercises_update_coach_scope ON public.program_exercises;
DROP POLICY IF EXISTS program_exercises_update_personal_owner ON public.program_exercises;
DROP POLICY IF EXISTS program_exercises_delete ON public.program_exercises;
DROP POLICY IF EXISTS program_exercises_delete_coach_scope ON public.program_exercises;
DROP POLICY IF EXISTS program_exercises_delete_personal_owner ON public.program_exercises;

CREATE POLICY program_exercises_select ON public.program_exercises
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    day_id IN (
      SELECT pd.id FROM public.program_days pd
      JOIN public.program_weeks pw ON pw.id = pd.week_id
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.owner_profile_id = (select auth.uid())
         OR pb.coach_id = (select auth.uid())
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c
           WHERE c.user_id = (select auth.uid())
              OR c.coach_id = (select auth.uid())
              OR (c.coach_id IS NULL AND c.trainer_id = (select auth.uid()))
         )
         OR pb.owner_profile_id IN (
           SELECT c.user_id FROM public.clients c
           WHERE c.coach_id = (select auth.uid()) AND c.user_id IS NOT NULL
         )
    )
  );

CREATE POLICY program_exercises_insert ON public.program_exercises
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    day_id IN (
      SELECT pd.id FROM public.program_days pd
      JOIN public.program_weeks pw ON pw.id = pd.week_id
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.owner_profile_id = (select auth.uid())
         OR pb.coach_id = (select auth.uid())
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c
           WHERE c.coach_id = (select auth.uid())
              OR (c.coach_id IS NULL AND c.trainer_id = (select auth.uid()))
         )
    )
  );

CREATE POLICY program_exercises_update ON public.program_exercises
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    day_id IN (
      SELECT pd.id FROM public.program_days pd
      JOIN public.program_weeks pw ON pw.id = pd.week_id
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.owner_profile_id = (select auth.uid())
         OR pb.coach_id = (select auth.uid())
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c
           WHERE c.coach_id = (select auth.uid())
              OR (c.coach_id IS NULL AND c.trainer_id = (select auth.uid()))
         )
    )
  )
  WITH CHECK (
    day_id IN (
      SELECT pd.id FROM public.program_days pd
      JOIN public.program_weeks pw ON pw.id = pd.week_id
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.owner_profile_id = (select auth.uid())
         OR pb.coach_id = (select auth.uid())
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c
           WHERE c.coach_id = (select auth.uid())
              OR (c.coach_id IS NULL AND c.trainer_id = (select auth.uid()))
         )
    )
  );

CREATE POLICY program_exercises_delete ON public.program_exercises
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    day_id IN (
      SELECT pd.id FROM public.program_days pd
      JOIN public.program_weeks pw ON pw.id = pd.week_id
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.owner_profile_id = (select auth.uid())
         OR pb.coach_id = (select auth.uid())
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c
           WHERE c.coach_id = (select auth.uid())
              OR (c.coach_id IS NULL AND c.trainer_id = (select auth.uid()))
         )
    )
  );

-- -----------------------------------------------------------------------------
-- 5) workout_sessions — athlete owns reads+writes; coach of a linked client
--    gets read-only. (Old *_own policies had no TO clause; anon had
--    auth.uid() NULL so every arm was already false — TO authenticated is
--    an equivalent-in-effect narrowing that also skips evaluation for anon.)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS workout_sessions_select_own ON public.workout_sessions;
DROP POLICY IF EXISTS workout_sessions_select_coach ON public.workout_sessions;
DROP POLICY IF EXISTS workout_sessions_insert_own ON public.workout_sessions;
DROP POLICY IF EXISTS workout_sessions_update_own ON public.workout_sessions;
DROP POLICY IF EXISTS workout_sessions_delete_own ON public.workout_sessions;

CREATE POLICY workout_sessions_select ON public.workout_sessions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    profile_id = (select auth.uid())
    OR (client_id IS NOT NULL AND client_id IN (
      SELECT c.id FROM public.clients c
      WHERE c.user_id = (select auth.uid())
         OR c.coach_id = (select auth.uid())
         OR (c.coach_id IS NULL AND c.trainer_id = (select auth.uid()))
    ))
  );

CREATE POLICY workout_sessions_insert ON public.workout_sessions
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = (select auth.uid())
    OR (client_id IS NOT NULL AND client_id IN (
      SELECT c.id FROM public.clients c WHERE c.user_id = (select auth.uid())
    ))
  );

CREATE POLICY workout_sessions_update ON public.workout_sessions
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    profile_id = (select auth.uid())
    OR (client_id IS NOT NULL AND client_id IN (
      SELECT c.id FROM public.clients c WHERE c.user_id = (select auth.uid())
    ))
  );

CREATE POLICY workout_sessions_delete ON public.workout_sessions
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    profile_id = (select auth.uid())
    OR (client_id IS NOT NULL AND client_id IN (
      SELECT c.id FROM public.clients c WHERE c.user_id = (select auth.uid())
    ))
  );

-- -----------------------------------------------------------------------------
-- 6) workout_session_sets (access via parent session)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS workout_session_sets_select_own ON public.workout_session_sets;
DROP POLICY IF EXISTS workout_session_sets_select_coach ON public.workout_session_sets;
DROP POLICY IF EXISTS workout_session_sets_insert_own ON public.workout_session_sets;
DROP POLICY IF EXISTS workout_session_sets_update_own ON public.workout_session_sets;
DROP POLICY IF EXISTS workout_session_sets_delete_own ON public.workout_session_sets;

CREATE POLICY workout_session_sets_select ON public.workout_session_sets
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    session_id IN (
      SELECT ws.id FROM public.workout_sessions ws
      WHERE ws.profile_id = (select auth.uid())
         OR (ws.client_id IS NOT NULL AND ws.client_id IN (
           SELECT c.id FROM public.clients c
           WHERE c.user_id = (select auth.uid())
              OR c.coach_id = (select auth.uid())
              OR (c.coach_id IS NULL AND c.trainer_id = (select auth.uid()))
         ))
    )
  );

CREATE POLICY workout_session_sets_insert ON public.workout_session_sets
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    session_id IN (
      SELECT ws.id FROM public.workout_sessions ws
      WHERE ws.profile_id = (select auth.uid())
         OR (ws.client_id IS NOT NULL AND ws.client_id IN (
           SELECT c.id FROM public.clients c WHERE c.user_id = (select auth.uid())
         ))
    )
  );

CREATE POLICY workout_session_sets_update ON public.workout_session_sets
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    session_id IN (
      SELECT ws.id FROM public.workout_sessions ws
      WHERE ws.profile_id = (select auth.uid())
         OR (ws.client_id IS NOT NULL AND ws.client_id IN (
           SELECT c.id FROM public.clients c WHERE c.user_id = (select auth.uid())
         ))
    )
  );

CREATE POLICY workout_session_sets_delete ON public.workout_session_sets
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    session_id IN (
      SELECT ws.id FROM public.workout_sessions ws
      WHERE ws.profile_id = (select auth.uid())
         OR (ws.client_id IS NOT NULL AND ws.client_id IN (
           SELECT c.id FROM public.clients c WHERE c.user_id = (select auth.uid())
         ))
    )
  );
