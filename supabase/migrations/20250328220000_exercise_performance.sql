-- Exercise performance trends: one row per logged set (weight, reps, RIR) for charting/analytics.
-- Links to client, exercise (program_exercises), and optional workout session.

CREATE TABLE IF NOT EXISTS public.exercise_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES public.program_exercises(id) ON DELETE SET NULL,
  weight NUMERIC,
  reps INTEGER,
  rir NUMERIC,
  session_id UUID REFERENCES public.workout_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exercise_performance_client_id ON public.exercise_performance(client_id);
CREATE INDEX IF NOT EXISTS idx_exercise_performance_exercise_id ON public.exercise_performance(exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercise_performance_session_id ON public.exercise_performance(session_id);
CREATE INDEX IF NOT EXISTS idx_exercise_performance_created_at ON public.exercise_performance(created_at DESC);

COMMENT ON TABLE public.exercise_performance IS 'Logged exercise performance (weight, reps, RIR) per client for trends and analytics.';

ALTER TABLE public.exercise_performance ENABLE ROW LEVEL SECURITY;

-- Coach: full access for their clients
DROP POLICY IF EXISTS exercise_performance_select_coach ON public.exercise_performance;
DROP POLICY IF EXISTS exercise_performance_insert_coach ON public.exercise_performance;
DROP POLICY IF EXISTS exercise_performance_update_coach ON public.exercise_performance;
DROP POLICY IF EXISTS exercise_performance_delete_coach ON public.exercise_performance;

CREATE POLICY exercise_performance_select_coach ON public.exercise_performance
  FOR SELECT USING (
    client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid() OR trainer_id = auth.uid())
  );
CREATE POLICY exercise_performance_insert_coach ON public.exercise_performance
  FOR INSERT WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid() OR trainer_id = auth.uid())
  );
CREATE POLICY exercise_performance_update_coach ON public.exercise_performance
  FOR UPDATE USING (
    client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid() OR trainer_id = auth.uid())
  );
CREATE POLICY exercise_performance_delete_coach ON public.exercise_performance
  FOR DELETE USING (
    client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid() OR trainer_id = auth.uid())
  );

-- Client: read/write own (via clients.user_id)
DROP POLICY IF EXISTS exercise_performance_select_client ON public.exercise_performance;
DROP POLICY IF EXISTS exercise_performance_insert_client ON public.exercise_performance;
DROP POLICY IF EXISTS exercise_performance_update_client ON public.exercise_performance;
DROP POLICY IF EXISTS exercise_performance_delete_client ON public.exercise_performance;

CREATE POLICY exercise_performance_select_client ON public.exercise_performance
  FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
CREATE POLICY exercise_performance_insert_client ON public.exercise_performance
  FOR INSERT WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
CREATE POLICY exercise_performance_update_client ON public.exercise_performance
  FOR UPDATE USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
CREATE POLICY exercise_performance_delete_client ON public.exercise_performance
  FOR DELETE USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
