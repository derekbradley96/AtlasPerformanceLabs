-- Check-ins RLS: allow coaches linked via coach_id (not only trainer_id).

DROP POLICY IF EXISTS checkins_insert_client ON public.checkins;
CREATE POLICY checkins_insert_client ON public.checkins
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT id
      FROM public.clients
      WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS checkins_update_coach ON public.checkins;
CREATE POLICY checkins_update_coach ON public.checkins
  FOR UPDATE TO authenticated
  USING (
    client_id IN (
      SELECT id
      FROM public.clients
      WHERE trainer_id = (SELECT auth.uid())
         OR coach_id = (SELECT auth.uid())
    )
  );
