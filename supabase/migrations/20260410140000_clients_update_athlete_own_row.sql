-- Athletes must update their own clients row (training prefs, injuries) from Profile.
-- Existing clients_update_own only allows the coach (COALESCE(coach_id, trainer_id) = auth.uid()).
-- This policy ORs with coach policy: client updates WHERE user_id = auth.uid().

DROP POLICY IF EXISTS clients_update_athlete_own_row ON public.clients;
CREATE POLICY clients_update_athlete_own_row ON public.clients
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY clients_update_athlete_own_row ON public.clients IS
  'Client (athlete) may update their roster row when clients.user_id matches auth.uid(); cannot reassign user_id.';
