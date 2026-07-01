-- Coaches need read access to personal_nutrition_adherence rows for clients who
-- converted from personal users. The row's profile_id matches the client's user_id.
-- Only SELECT is needed — coaches never write personal adherence data.

DROP POLICY IF EXISTS personal_nutrition_adherence_coach_read ON public.personal_nutrition_adherence;
CREATE POLICY personal_nutrition_adherence_coach_read
  ON public.personal_nutrition_adherence
  FOR SELECT TO authenticated
  USING (
    profile_id IN (
      SELECT user_id FROM public.clients
      WHERE coach_id = (SELECT auth.uid())
        AND user_id IS NOT NULL
    )
  );
