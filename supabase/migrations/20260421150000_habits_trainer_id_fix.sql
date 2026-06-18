-- Ensure habit RLS allows either coach_id or trainer_id ownership.
-- Safe across mixed environments where habit logs may be in:
-- - public.habit_logs (legacy table), or
-- - public.client_habit_logs (current table).

DROP POLICY IF EXISTS client_habits_select_coach ON public.client_habits;
DROP POLICY IF EXISTS client_habits_insert_coach ON public.client_habits;
DROP POLICY IF EXISTS client_habits_update_coach ON public.client_habits;
DROP POLICY IF EXISTS client_habits_delete_coach ON public.client_habits;

CREATE POLICY client_habits_select_coach ON public.client_habits
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = client_habits.client_id
        AND (c.coach_id = (SELECT auth.uid()) OR c.trainer_id = (SELECT auth.uid()))
    )
  );

CREATE POLICY client_habits_insert_coach ON public.client_habits
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = client_habits.client_id
        AND (c.coach_id = (SELECT auth.uid()) OR c.trainer_id = (SELECT auth.uid()))
    )
  );

CREATE POLICY client_habits_update_coach ON public.client_habits
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = client_habits.client_id
        AND (c.coach_id = (SELECT auth.uid()) OR c.trainer_id = (SELECT auth.uid()))
    )
  );

CREATE POLICY client_habits_delete_coach ON public.client_habits
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = client_habits.client_id
        AND (c.coach_id = (SELECT auth.uid()) OR c.trainer_id = (SELECT auth.uid()))
    )
  );

DO $$
BEGIN
  -- Legacy table path: public.habit_logs
  IF EXISTS (
    SELECT 1
    FROM pg_class pc
    JOIN pg_namespace pn ON pn.oid = pc.relnamespace
    WHERE pn.nspname = 'public' AND pc.relname = 'habit_logs' AND pc.relkind = 'r'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS habit_logs_select_coach ON public.habit_logs';
    EXECUTE 'DROP POLICY IF EXISTS habit_logs_insert_coach ON public.habit_logs';
    EXECUTE 'DROP POLICY IF EXISTS habit_logs_update_coach ON public.habit_logs';
    EXECUTE 'DROP POLICY IF EXISTS habit_logs_delete_coach ON public.habit_logs';

    EXECUTE $sql$
      CREATE POLICY habit_logs_select_coach ON public.habit_logs
      FOR SELECT TO authenticated USING (
        EXISTS (
          SELECT 1
          FROM public.client_habits h
          JOIN public.clients c ON c.id = h.client_id
          WHERE h.id = habit_logs.habit_id
            AND (c.coach_id = (SELECT auth.uid()) OR c.trainer_id = (SELECT auth.uid()))
        )
      )
    $sql$;

    EXECUTE $sql$
      CREATE POLICY habit_logs_insert_coach ON public.habit_logs
      FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.client_habits h
          JOIN public.clients c ON c.id = h.client_id
          WHERE h.id = habit_logs.habit_id
            AND (c.coach_id = (SELECT auth.uid()) OR c.trainer_id = (SELECT auth.uid()))
        )
      )
    $sql$;

    EXECUTE $sql$
      CREATE POLICY habit_logs_update_coach ON public.habit_logs
      FOR UPDATE TO authenticated USING (
        EXISTS (
          SELECT 1
          FROM public.client_habits h
          JOIN public.clients c ON c.id = h.client_id
          WHERE h.id = habit_logs.habit_id
            AND (c.coach_id = (SELECT auth.uid()) OR c.trainer_id = (SELECT auth.uid()))
        )
      )
    $sql$;

    EXECUTE $sql$
      CREATE POLICY habit_logs_delete_coach ON public.habit_logs
      FOR DELETE TO authenticated USING (
        EXISTS (
          SELECT 1
          FROM public.client_habits h
          JOIN public.clients c ON c.id = h.client_id
          WHERE h.id = habit_logs.habit_id
            AND (c.coach_id = (SELECT auth.uid()) OR c.trainer_id = (SELECT auth.uid()))
        )
      )
    $sql$;
  END IF;

  -- Current table path: public.client_habit_logs
  IF EXISTS (
    SELECT 1
    FROM pg_class pc
    JOIN pg_namespace pn ON pn.oid = pc.relnamespace
    WHERE pn.nspname = 'public' AND pc.relname = 'client_habit_logs' AND pc.relkind = 'r'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS client_habit_logs_select_coach ON public.client_habit_logs';
    EXECUTE 'DROP POLICY IF EXISTS client_habit_logs_insert_coach ON public.client_habit_logs';
    EXECUTE 'DROP POLICY IF EXISTS client_habit_logs_update_coach ON public.client_habit_logs';
    EXECUTE 'DROP POLICY IF EXISTS client_habit_logs_delete_coach ON public.client_habit_logs';

    EXECUTE $sql$
      CREATE POLICY client_habit_logs_select_coach ON public.client_habit_logs
      FOR SELECT TO authenticated USING (
        EXISTS (
          SELECT 1
          FROM public.client_habits h
          JOIN public.clients c ON c.id = h.client_id
          WHERE h.id = client_habit_logs.habit_id
            AND (c.coach_id = (SELECT auth.uid()) OR c.trainer_id = (SELECT auth.uid()))
        )
      )
    $sql$;

    EXECUTE $sql$
      CREATE POLICY client_habit_logs_insert_coach ON public.client_habit_logs
      FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.client_habits h
          JOIN public.clients c ON c.id = h.client_id
          WHERE h.id = client_habit_logs.habit_id
            AND (c.coach_id = (SELECT auth.uid()) OR c.trainer_id = (SELECT auth.uid()))
        )
      )
    $sql$;

    EXECUTE $sql$
      CREATE POLICY client_habit_logs_update_coach ON public.client_habit_logs
      FOR UPDATE TO authenticated USING (
        EXISTS (
          SELECT 1
          FROM public.client_habits h
          JOIN public.clients c ON c.id = h.client_id
          WHERE h.id = client_habit_logs.habit_id
            AND (c.coach_id = (SELECT auth.uid()) OR c.trainer_id = (SELECT auth.uid()))
        )
      )
    $sql$;

    EXECUTE $sql$
      CREATE POLICY client_habit_logs_delete_coach ON public.client_habit_logs
      FOR DELETE TO authenticated USING (
        EXISTS (
          SELECT 1
          FROM public.client_habits h
          JOIN public.clients c ON c.id = h.client_id
          WHERE h.id = client_habit_logs.habit_id
            AND (c.coach_id = (SELECT auth.uid()) OR c.trainer_id = (SELECT auth.uid()))
        )
      )
    $sql$;
  END IF;
END $$;
