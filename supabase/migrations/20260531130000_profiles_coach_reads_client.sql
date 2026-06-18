-- Coaches need to read profile display names and avatars
-- for clients they manage. The existing profiles SELECT policy
-- (profiles_select_own_is_admin) only allows id = auth.uid().
-- This adds a policy so coaches can also read their clients' profiles.

DROP POLICY IF EXISTS profiles_coach_can_read_client_profiles
  ON public.profiles;

CREATE POLICY profiles_coach_can_read_client_profiles
  ON public.profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR
    id IN (
      SELECT user_id
      FROM public.clients
      WHERE
        (coach_id = auth.uid() OR trainer_id = auth.uid())
        AND user_id IS NOT NULL
    )
  );
