-- Performance Advisor: auth_rls_initplan on public.checkins
-- Wrap auth.uid() as (SELECT auth.uid()) so JWT claims are not re-evaluated per row.
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

DROP POLICY IF EXISTS checkins_select_authenticated ON public.checkins;
CREATE POLICY checkins_select_authenticated ON public.checkins
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (SELECT id FROM public.clients WHERE trainer_id = (SELECT auth.uid()))
    OR client_id IN (SELECT id FROM public.clients WHERE user_id = (SELECT auth.uid()))
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

DROP POLICY IF EXISTS checkins_insert_authenticated ON public.checkins;
CREATE POLICY checkins_insert_authenticated ON public.checkins
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients
      WHERE user_id = (SELECT auth.uid()) OR trainer_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS checkins_update_coach ON public.checkins;
CREATE POLICY checkins_update_coach ON public.checkins
  FOR UPDATE
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE trainer_id = (SELECT auth.uid())
    )
  );
