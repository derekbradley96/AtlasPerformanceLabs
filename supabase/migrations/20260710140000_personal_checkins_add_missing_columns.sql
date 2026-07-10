-- personal_checkins drifted behind the code: three call sites write or read
-- columns that never existed on the table.
--   * PersonalBasicPostWorkoutCheckIn inserts recovery/performance/
--     workout_session_id with NO fallback -> every post-workout check-in save
--     threw 42703 (undefined column) and was lost.
--   * ReadinessCheckinPage inserts recovery; it "worked" only via a retry that
--     stripped recovery and discarded the value (plus a guaranteed-failing first
--     insert on every submit).
--   * fetchPersonalCheckinPerformanceSeries selects performance/recovery -> the
--     query errored and silently returned [], so the personal adaptation matrix
--     never saw any performance history.
-- Add the missing columns so all three work and the captured data is preserved.
-- Types match the existing 1-5 feel columns (integer); the app clamps ranges.
ALTER TABLE public.personal_checkins
  ADD COLUMN IF NOT EXISTS recovery integer,
  ADD COLUMN IF NOT EXISTS performance integer,
  ADD COLUMN IF NOT EXISTS workout_session_id uuid
    REFERENCES public.workout_sessions(id) ON DELETE SET NULL;
