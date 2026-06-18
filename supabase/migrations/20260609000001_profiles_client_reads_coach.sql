-- Allow clients to read their coach's profile.
-- Mirrors profiles_coach_can_read_client_profiles.

DROP POLICY IF EXISTS profiles_client_can_read_coach_profile
  ON public.profiles;

CREATE POLICY profiles_client_can_read_coach_profile
  ON public.profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR
    id IN (
      SELECT COALESCE(c.coach_id, c.trainer_id)
      FROM public.clients c
      WHERE
        c.user_id = auth.uid()
        AND (c.coach_id IS NOT NULL OR c.trainer_id IS NOT NULL)
    )
  );
