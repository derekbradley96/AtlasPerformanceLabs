-- 1. Add prescribed columns to workout_session_sets
--    Currently only prescribed_reps exists.
--    Add prescribed_weight, prescribed_rir, client_notes.

ALTER TABLE public.workout_session_sets
  ADD COLUMN IF NOT EXISTS prescribed_weight NUMERIC,
  ADD COLUMN IF NOT EXISTS prescribed_rir NUMERIC,
  ADD COLUMN IF NOT EXISTS prescribed_reps_raw TEXT,
  ADD COLUMN IF NOT EXISTS client_notes TEXT,
  ADD COLUMN IF NOT EXISTS rpe_done NUMERIC
    CHECK (rpe_done IS NULL OR (rpe_done >= 1 AND rpe_done <= 10));

COMMENT ON COLUMN public.workout_session_sets.prescribed_weight
  IS 'Coach-prescribed weight in kg for this specific set number.';
COMMENT ON COLUMN public.workout_session_sets.prescribed_rir
  IS 'Coach-prescribed RIR (reps in reserve) for this set.';
COMMENT ON COLUMN public.workout_session_sets.prescribed_reps_raw
  IS 'Original reps string from program_exercises e.g. "8-12".';
COMMENT ON COLUMN public.workout_session_sets.client_notes
  IS 'Client free-text note on this specific set.';

-- 2. Add per-set prescription to program_exercises
--    Currently program_exercises stores reps/sets as a
--    single value for all sets. Add a sets_config JSONB
--    column so coaches can prescribe different weight/reps
--    per set (e.g. pyramid loading).

ALTER TABLE public.program_exercises
  ADD COLUMN IF NOT EXISTS sets_config JSONB DEFAULT NULL;

COMMENT ON COLUMN public.program_exercises.sets_config IS
  'Optional per-set prescriptions. Array of
  [{set_number, weight_kg, reps, rir, notes}].
  When null: all sets use the top-level reps/weight fields.
  When set: overrides per set. Allows pyramid loading,
  warm-up sets, working sets to vary.';

-- 3. Add workout-level client readiness to workout_sessions

ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS readiness_sleep INTEGER
    CHECK (readiness_sleep IS NULL OR
      (readiness_sleep >= 1 AND readiness_sleep <= 10)),
  ADD COLUMN IF NOT EXISTS readiness_energy INTEGER
    CHECK (readiness_energy IS NULL OR
      (readiness_energy >= 1 AND readiness_energy <= 10)),
  ADD COLUMN IF NOT EXISTS readiness_soreness INTEGER
    CHECK (readiness_soreness IS NULL OR
      (readiness_soreness >= 1 AND readiness_soreness <= 10)),
  ADD COLUMN IF NOT EXISTS session_notes TEXT,
  ADD COLUMN IF NOT EXISTS session_rpe NUMERIC
    CHECK (session_rpe IS NULL OR
      (session_rpe >= 1 AND session_rpe <= 10)),
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

COMMENT ON COLUMN public.workout_sessions.readiness_sleep
  IS 'Client self-report: sleep quality 1-10 before session.';
COMMENT ON COLUMN public.workout_sessions.readiness_energy
  IS 'Client self-report: energy level 1-10 before session.';
COMMENT ON COLUMN public.workout_sessions.readiness_soreness
  IS 'Client self-report: muscle soreness 1-10 before session.';

-- 4. Add program_exercises.coach_updated_at for live edits

ALTER TABLE public.program_exercises
  ADD COLUMN IF NOT EXISTS coach_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS coach_update_note TEXT;

-- 5. Realtime for coach live edits to reach clients instantly

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'program_exercises'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.program_exercises;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'workout_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.workout_sessions;
  END IF;
END $$;

-- 6. Coach can read client workout sessions (for review)

DROP POLICY IF EXISTS workout_sessions_select_coach
  ON public.workout_sessions;
CREATE POLICY workout_sessions_select_coach
  ON public.workout_sessions
  FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE COALESCE(coach_id, trainer_id) = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS workout_session_sets_select_coach
  ON public.workout_session_sets;
CREATE POLICY workout_session_sets_select_coach
  ON public.workout_session_sets
  FOR SELECT TO authenticated
  USING (
    session_id IN (
      SELECT ws.id FROM public.workout_sessions ws
      JOIN public.clients c ON c.id = ws.client_id
      WHERE COALESCE(c.coach_id, c.trainer_id) = (SELECT auth.uid())
    )
  );

-- 7. Coach can update program_exercises (live edit)

DROP POLICY IF EXISTS program_exercises_update_coach
  ON public.program_exercises;
CREATE POLICY program_exercises_update_coach
  ON public.program_exercises
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.program_days pd
      JOIN public.program_weeks pw ON pw.id = pd.week_id
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pd.id = program_exercises.day_id
        AND (pb.coach_id = (SELECT auth.uid())
          OR pb.owner_profile_id = (SELECT auth.uid()))
    )
  );
