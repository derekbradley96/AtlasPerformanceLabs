-- Coaches can read workout_sessions for their clients (read-only) for dashboards / client OS.
-- Writes remain client-only via existing policies.

DROP POLICY IF EXISTS workout_sessions_select_coach ON public.workout_sessions;
CREATE POLICY workout_sessions_select_coach ON public.workout_sessions
  FOR SELECT
  USING (
    client_id IS NOT NULL
    AND public.current_user_owns_client(client_id)
  );

COMMENT ON POLICY workout_sessions_select_coach ON public.workout_sessions IS
  'Coach/trainer read access to client workout sessions for roster dashboards.';
