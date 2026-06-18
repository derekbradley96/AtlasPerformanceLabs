-- Shared show-day task checklist per contest prep (coach + athlete).

CREATE TABLE IF NOT EXISTS public.show_day_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_prep_id UUID NOT NULL
    REFERENCES public.contest_preps(id) ON DELETE CASCADE,
  task_category TEXT NOT NULL
    CHECK (task_category IN (
      'registration',
      'logistics',
      'appearance',
      'nutrition',
      'equipment',
      'admin'
    )),
  task_name TEXT NOT NULL,
  assigned_to TEXT NOT NULL
    CHECK (assigned_to IN ('athlete', 'coach', 'both')),
  is_complete BOOLEAN NOT NULL DEFAULT false,
  completed_by UUID REFERENCES public.profiles(id),
  completed_at TIMESTAMPTZ,
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS show_day_tasks_contest_prep_id_idx
  ON public.show_day_tasks(contest_prep_id);

ALTER TABLE public.show_day_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS show_day_tasks_select ON public.show_day_tasks;
CREATE POLICY show_day_tasks_select ON public.show_day_tasks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.contest_preps cp
      JOIN public.clients c ON c.id = cp.client_id
      WHERE cp.id = show_day_tasks.contest_prep_id
        AND (
          c.user_id = (SELECT auth.uid())
          OR c.coach_id = (SELECT auth.uid())
          OR c.trainer_id = (SELECT auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS show_day_tasks_insert_coach ON public.show_day_tasks;
CREATE POLICY show_day_tasks_insert_coach ON public.show_day_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.contest_preps cp
      JOIN public.clients c ON c.id = cp.client_id
      WHERE cp.id = show_day_tasks.contest_prep_id
        AND (
          c.coach_id = (SELECT auth.uid())
          OR c.trainer_id = (SELECT auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS show_day_tasks_insert_client ON public.show_day_tasks;
CREATE POLICY show_day_tasks_insert_client ON public.show_day_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.contest_preps cp
      JOIN public.clients c ON c.id = cp.client_id
      WHERE cp.id = show_day_tasks.contest_prep_id
        AND c.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS show_day_tasks_update ON public.show_day_tasks;
CREATE POLICY show_day_tasks_update ON public.show_day_tasks
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.contest_preps cp
      JOIN public.clients c ON c.id = cp.client_id
      WHERE cp.id = show_day_tasks.contest_prep_id
        AND (
          c.user_id = (SELECT auth.uid())
          OR c.coach_id = (SELECT auth.uid())
          OR c.trainer_id = (SELECT auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.contest_preps cp
      JOIN public.clients c ON c.id = cp.client_id
      WHERE cp.id = show_day_tasks.contest_prep_id
        AND (
          c.user_id = (SELECT auth.uid())
          OR c.coach_id = (SELECT auth.uid())
          OR c.trainer_id = (SELECT auth.uid())
        )
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'show_day_tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.show_day_tasks;
  END IF;
END $$;
