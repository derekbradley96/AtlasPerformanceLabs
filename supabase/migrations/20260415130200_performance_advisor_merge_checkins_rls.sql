-- Performance Advisor: multiple_permissive_policies on public.checkins
--
-- 1) Drop legacy/manual policy name if present (duplicates coach-side rules; not in repo migrations).
-- 2) Replace several permissive policies per command with one policy each, TO authenticated only.
--    (Same logical access as checkins_select_{coach,client,org_member}, insert_{client,coach}, update_coach.)

-- Manual / duplicate (Supabase linter lists this alongside checkins_* policies)
DROP POLICY IF EXISTS "Trainers manage their own checkins" ON public.checkins;

DROP POLICY IF EXISTS checkins_select_coach ON public.checkins;
DROP POLICY IF EXISTS checkins_select_client ON public.checkins;
DROP POLICY IF EXISTS checkins_select_org_member ON public.checkins;

CREATE POLICY checkins_select_authenticated ON public.checkins
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (SELECT id FROM public.clients WHERE trainer_id = auth.uid())
    OR client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    OR client_id IN (
      SELECT c.id
      FROM public.clients c
      WHERE c.organisation_id IS NOT NULL
        AND (
          c.organisation_id IN (SELECT public.current_user_organisation_ids())
          OR c.organisation_id IN (
            SELECT id FROM public.organisations WHERE owner_profile_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS checkins_insert_client ON public.checkins;
DROP POLICY IF EXISTS checkins_insert_coach ON public.checkins;

CREATE POLICY checkins_insert_authenticated ON public.checkins
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients
      WHERE user_id = auth.uid() OR trainer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS checkins_update_coach ON public.checkins;

CREATE POLICY checkins_update_coach ON public.checkins
  FOR UPDATE
  TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE trainer_id = auth.uid()));
