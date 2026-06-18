CREATE TABLE IF NOT EXISTS public.workout_exercise_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES public.program_exercises(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workout_exercise_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workout_exercise_notes_own ON public.workout_exercise_notes;
CREATE POLICY workout_exercise_notes_own
  ON public.workout_exercise_notes FOR ALL TO authenticated
  USING (
    session_id IN (
      SELECT id FROM public.workout_sessions
      WHERE profile_id = (SELECT auth.uid())
      OR client_id IN (
        SELECT id FROM public.clients
        WHERE user_id = (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (
    session_id IN (
      SELECT id FROM public.workout_sessions
      WHERE profile_id = (SELECT auth.uid())
      OR client_id IN (
        SELECT id FROM public.clients
        WHERE user_id = (SELECT auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS workout_exercise_notes_coach ON public.workout_exercise_notes;
CREATE POLICY workout_exercise_notes_coach
  ON public.workout_exercise_notes FOR SELECT TO authenticated
  USING (
    session_id IN (
      SELECT ws.id FROM public.workout_sessions ws
      JOIN public.clients c ON c.id = ws.client_id
      WHERE COALESCE(c.coach_id, c.trainer_id) = (SELECT auth.uid())
    )
  );
