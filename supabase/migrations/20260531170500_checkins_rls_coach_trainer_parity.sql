-- Ensure checkins RLS grants coach access via either clients.coach_id or clients.trainer_id.
-- This fixes invisible submitted check-ins when ownership is recorded on coach_id only.

-- SELECT
DROP POLICY IF EXISTS checkins_select_coach ON public.checkins;
DROP POLICY IF EXISTS checkins_select_authenticated ON public.checkins;
CREATE POLICY checkins_select_authenticated ON public.checkins
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id
      FROM public.clients
      WHERE trainer_id = (SELECT auth.uid())
         OR coach_id = (SELECT auth.uid())
    )
    OR client_id IN (
      SELECT id
      FROM public.clients
      WHERE user_id = (SELECT auth.uid())
    )
    OR client_id IN (
      SELECT c.id
      FROM public.clients c
      WHERE c.organisation_id IS NOT NULL
        AND (
          c.organisation_id IN (SELECT public.current_user_organisation_ids())
          OR c.organisation_id IN (
            SELECT id FROM public.organisations WHERE owner_profile_id = (SELECT auth.uid())
          )
        )
    )
  );

-- INSERT
DROP POLICY IF EXISTS checkins_insert_coach ON public.checkins;
DROP POLICY IF EXISTS checkins_insert_authenticated ON public.checkins;
CREATE POLICY checkins_insert_authenticated ON public.checkins
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT id
      FROM public.clients
      WHERE user_id = (SELECT auth.uid())
         OR trainer_id = (SELECT auth.uid())
         OR coach_id = (SELECT auth.uid())
    )
  );

-- UPDATE
DROP POLICY IF EXISTS checkins_update_coach ON public.checkins;
CREATE POLICY checkins_update_coach ON public.checkins
  FOR UPDATE
  TO authenticated
  USING (
    client_id IN (
      SELECT id
      FROM public.clients
      WHERE trainer_id = (SELECT auth.uid())
         OR coach_id = (SELECT auth.uid())
    )
  );
