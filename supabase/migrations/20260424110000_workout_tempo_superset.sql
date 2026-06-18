-- program_exercises: add tempo, superset_group, weight_kg, rir columns
-- These are missing from the original schema

ALTER TABLE public.program_exercises
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS rir NUMERIC,
  ADD COLUMN IF NOT EXISTS rest_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS tempo TEXT,
  ADD COLUMN IF NOT EXISTS superset_group TEXT,
  ADD COLUMN IF NOT EXISTS is_warmup_parent BOOLEAN
    NOT NULL DEFAULT false;

COMMENT ON COLUMN public.program_exercises.tempo IS
  'Tempo string: eccentric-pause-concentric e.g. "3-1-1".
   Null means no tempo prescribed.';

COMMENT ON COLUMN public.program_exercises.superset_group IS
  'Exercises with the same superset_group are paired.
   e.g. "A" links A1: Bench Press and A2: DB Row.
   Null means standalone exercise.';

COMMENT ON COLUMN public.program_exercises.is_warmup_parent IS
  'True if warm-up sets should be auto-generated before
   this exercise based on first working set weight.';

-- workout_sessions: add session_rpe (overall session feel)
ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS session_rpe NUMERIC
    CHECK (session_rpe IS NULL OR
      (session_rpe >= 1 AND session_rpe <= 10));

COMMENT ON COLUMN public.workout_sessions.session_rpe IS
  'Client overall session RPE 1-10, entered after completion.';
