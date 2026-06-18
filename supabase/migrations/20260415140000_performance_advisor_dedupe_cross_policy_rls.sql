-- Performance Advisor: remove cross-bucket permissive duplicates left after pa_mg merge.
--
-- 1) Drop legacy FOR ALL clients policy from early Supabase setup (granular policies + pa_mg cover it).
-- 2) Drop human-named coach duplicates on compliance/flags/program tables (if present).
-- 3) Split nutrition "Trainers CRUD" FOR ALL + client SELECT into one merged SELECT + coach-only mutating policies.
-- 4) Merge clients UPDATE coach + athlete into one policy (same OR semantics).
-- 5) Drop pa_mg_* on tables where canonical named policies already encode coach/personal/client paths.
-- 6) Drop stray *_participant messaging policies if they duplicate 20260409180000 policies.
--
-- Note: program_* may still report multiple_permissive_policies while coach + personal_owner + client
-- SELECT policies remain separate; consolidating those requires a follow-up merge per table.

-- -----------------------------------------------------------------------------
-- 1) Legacy clients FOR ALL (see SUPABASE_SETUP.md) — duplicates clients_* / pa_mg_*
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Trainers manage their own clients" ON public.clients;

-- -----------------------------------------------------------------------------
-- 2) Optional dashboard / manual duplicates (names from Performance Advisor)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "coach can manage own compliance" ON public.client_compliance;
DROP POLICY IF EXISTS "coach can manage own flags" ON public.client_flags;
DROP POLICY IF EXISTS "coach can manage own blocks" ON public.program_blocks;
DROP POLICY IF EXISTS "coach can manage own days" ON public.program_days;
DROP POLICY IF EXISTS "coach can manage own weeks" ON public.program_weeks;
DROP POLICY IF EXISTS "coach can manage own exercises" ON public.program_exercises;

-- -----------------------------------------------------------------------------
-- 3) nutrition_plans: one SELECT (coach OR client athlete); coach-only INSERT/UPDATE/DELETE
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Trainers CRUD own nutrition plans" ON public.nutrition_plans;
DROP POLICY IF EXISTS nutrition_plans_select_client_own ON public.nutrition_plans;

CREATE POLICY nutrition_plans_select_scope ON public.nutrition_plans
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id
      FROM public.clients c
      WHERE c.coach_id = (SELECT auth.uid())
    )
    OR client_id IN (
      SELECT c.id
      FROM public.clients c
      WHERE c.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY nutrition_plans_insert_coach ON public.nutrition_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients WHERE coach_id = (SELECT auth.uid())
    )
  );

CREATE POLICY nutrition_plans_update_coach ON public.nutrition_plans
  FOR UPDATE
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE coach_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients WHERE coach_id = (SELECT auth.uid())
    )
  );

CREATE POLICY nutrition_plans_delete_coach ON public.nutrition_plans
  FOR DELETE
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE coach_id = (SELECT auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- 4) nutrition_plan_weeks: same pattern
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Trainers CRUD own nutrition plan weeks" ON public.nutrition_plan_weeks;
DROP POLICY IF EXISTS nutrition_plan_weeks_select_client_own ON public.nutrition_plan_weeks;

CREATE POLICY nutrition_plan_weeks_select_scope ON public.nutrition_plan_weeks
  FOR SELECT
  TO authenticated
  USING (
    plan_id IN (
      SELECT np.id
      FROM public.nutrition_plans np
      JOIN public.clients c ON c.id = np.client_id
      WHERE c.coach_id = (SELECT auth.uid())
    )
    OR plan_id IN (
      SELECT np.id
      FROM public.nutrition_plans np
      JOIN public.clients c ON c.id = np.client_id
      WHERE c.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY nutrition_plan_weeks_insert_coach ON public.nutrition_plan_weeks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    plan_id IN (
      SELECT np.id
      FROM public.nutrition_plans np
      JOIN public.clients c ON c.id = np.client_id
      WHERE c.coach_id = (SELECT auth.uid())
    )
  );

CREATE POLICY nutrition_plan_weeks_update_coach ON public.nutrition_plan_weeks
  FOR UPDATE
  TO authenticated
  USING (
    plan_id IN (
      SELECT np.id
      FROM public.nutrition_plans np
      JOIN public.clients c ON c.id = np.client_id
      WHERE c.coach_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    plan_id IN (
      SELECT np.id
      FROM public.nutrition_plans np
      JOIN public.clients c ON c.id = np.client_id
      WHERE c.coach_id = (SELECT auth.uid())
    )
  );

CREATE POLICY nutrition_plan_weeks_delete_coach ON public.nutrition_plan_weeks
  FOR DELETE
  TO authenticated
  USING (
    plan_id IN (
      SELECT np.id
      FROM public.nutrition_plans np
      JOIN public.clients c ON c.id = np.client_id
      WHERE c.coach_id = (SELECT auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- 5) clients: single UPDATE policy (coach OR linked athlete)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS clients_update_own ON public.clients;
DROP POLICY IF EXISTS clients_update_athlete_own_row ON public.clients;

CREATE POLICY clients_update_coach_or_athlete ON public.clients
  FOR UPDATE
  TO authenticated
  USING (
    COALESCE(coach_id, trainer_id) = (SELECT auth.uid())
    OR user_id = (SELECT auth.uid())
  )
  WITH CHECK (
    COALESCE(coach_id, trainer_id) = (SELECT auth.uid())
    OR user_id = (SELECT auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 6) Messaging: remove duplicate participant aliases (canonical names in 20260409180000)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS threads_delete_participant ON public.message_threads;
DROP POLICY IF EXISTS messages_update_participant ON public.message_messages;

-- -----------------------------------------------------------------------------
-- 7) Drop pa_mg_* merged policies where base policies remain
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
          'nutrition_plans',
          'nutrition_plan_weeks',
          'program_blocks',
          'program_days',
          'program_weeks',
          'program_exercises',
          'message_threads',
          'message_messages'
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
