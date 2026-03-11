-- Workout execution: sessions and sets for Today page.
-- RLS: user can only access their own sessions (client via clients.user_id, personal via profile_id = auth.uid()).

-- A) workout_sessions
CREATE TABLE IF NOT EXISTS public.workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  program_day_id UUID REFERENCES public.program_days(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workout_sessions_client_id ON public.workout_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_profile_id ON public.workout_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_status ON public.workout_sessions(status);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_started_at ON public.workout_sessions(started_at DESC);

COMMENT ON TABLE public.workout_sessions IS 'One row per workout execution; client_id for coached clients, profile_id for personal.';

-- B) workout_session_sets
CREATE TABLE IF NOT EXISTS public.workout_session_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES public.program_exercises(id) ON DELETE SET NULL,
  set_number INT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  reps_done INT,
  weight_done NUMERIC,
  rir_done NUMERIC,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_workout_session_sets_session_id ON public.workout_session_sets(session_id);
CREATE INDEX IF NOT EXISTS idx_workout_session_sets_exercise_id ON public.workout_session_sets(exercise_id);

COMMENT ON TABLE public.workout_session_sets IS 'One row per set logged within a workout session.';

-- RLS
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_session_sets ENABLE ROW LEVEL SECURITY;

-- workout_sessions: user owns if (client_id IN clients where user_id = auth.uid()) OR (profile_id = auth.uid())
DROP POLICY IF EXISTS workout_sessions_select_own ON public.workout_sessions;
CREATE POLICY workout_sessions_select_own ON public.workout_sessions
  FOR SELECT USING (
    (client_id IS NOT NULL AND client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()))
    OR (profile_id = auth.uid())
  );

DROP POLICY IF EXISTS workout_sessions_insert_own ON public.workout_sessions;
CREATE POLICY workout_sessions_insert_own ON public.workout_sessions
  FOR INSERT WITH CHECK (
    (client_id IS NOT NULL AND client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()))
    OR (profile_id = auth.uid())
  );

DROP POLICY IF EXISTS workout_sessions_update_own ON public.workout_sessions;
CREATE POLICY workout_sessions_update_own ON public.workout_sessions
  FOR UPDATE USING (
    (client_id IS NOT NULL AND client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()))
    OR (profile_id = auth.uid())
  );

DROP POLICY IF EXISTS workout_sessions_delete_own ON public.workout_sessions;
CREATE POLICY workout_sessions_delete_own ON public.workout_sessions
  FOR DELETE USING (
    (client_id IS NOT NULL AND client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()))
    OR (profile_id = auth.uid())
  );

-- workout_session_sets: via session ownership
DROP POLICY IF EXISTS workout_session_sets_select_own ON public.workout_session_sets;
CREATE POLICY workout_session_sets_select_own ON public.workout_session_sets
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM public.workout_sessions
      WHERE (client_id IS NOT NULL AND client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()))
         OR (profile_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS workout_session_sets_insert_own ON public.workout_session_sets;
CREATE POLICY workout_session_sets_insert_own ON public.workout_session_sets
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT id FROM public.workout_sessions
      WHERE (client_id IS NOT NULL AND client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()))
         OR (profile_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS workout_session_sets_update_own ON public.workout_session_sets;
CREATE POLICY workout_session_sets_update_own ON public.workout_session_sets
  FOR UPDATE USING (
    session_id IN (
      SELECT id FROM public.workout_sessions
      WHERE (client_id IS NOT NULL AND client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()))
         OR (profile_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS workout_session_sets_delete_own ON public.workout_session_sets;
CREATE POLICY workout_session_sets_delete_own ON public.workout_session_sets
  FOR DELETE USING (
    session_id IN (
      SELECT id FROM public.workout_sessions
      WHERE (client_id IS NOT NULL AND client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()))
         OR (profile_id = auth.uid())
    )
  );
