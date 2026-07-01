-- When a personal user converts to a client, coaches need to see their historical
-- program blocks (which have owner_profile_id = user_id, coach_id = user_id).
-- At conversion time (inviteConversion.js) we update coach_id to the new coach,
-- which the SELECT policy above already covers. But we also add an explicit policy
-- so coaches can read any personal block owned by one of their clients' user_ids,
-- as a safety net for any blocks not yet updated.

-- Allow coaches to see personal blocks belonging to their clients
DROP POLICY IF EXISTS program_blocks_select_client_personal ON public.program_blocks;
CREATE POLICY program_blocks_select_client_personal ON public.program_blocks
  FOR SELECT TO authenticated
  USING (
    owner_profile_id IN (
      SELECT user_id FROM public.clients
      WHERE coach_id = (SELECT auth.uid())
        AND user_id IS NOT NULL
    )
  );

-- Same cascade for weeks/days/exercises via personal block ownership
DROP POLICY IF EXISTS program_weeks_select_client_personal ON public.program_weeks;
CREATE POLICY program_weeks_select_client_personal ON public.program_weeks
  FOR SELECT TO authenticated
  USING (
    block_id IN (
      SELECT pb.id FROM public.program_blocks pb
      JOIN public.clients c ON c.user_id = pb.owner_profile_id
      WHERE c.coach_id = (SELECT auth.uid())
        AND c.user_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS program_days_select_client_personal ON public.program_days;
CREATE POLICY program_days_select_client_personal ON public.program_days
  FOR SELECT TO authenticated
  USING (
    week_id IN (
      SELECT pw.id FROM public.program_weeks pw
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      JOIN public.clients c ON c.user_id = pb.owner_profile_id
      WHERE c.coach_id = (SELECT auth.uid())
        AND c.user_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS program_exercises_select_client_personal ON public.program_exercises;
CREATE POLICY program_exercises_select_client_personal ON public.program_exercises
  FOR SELECT TO authenticated
  USING (
    day_id IN (
      SELECT pd.id FROM public.program_days pd
      JOIN public.program_weeks pw ON pw.id = pd.week_id
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      JOIN public.clients c ON c.user_id = pb.owner_profile_id
      WHERE c.coach_id = (SELECT auth.uid())
        AND c.user_id IS NOT NULL
    )
  );

-- Fix personal_program_assignments INSERT RLS to verify block ownership.
-- Previously only checked profile_id = auth.uid(), allowing a user to assign
-- any block (including another user's block) to themselves.
DROP POLICY IF EXISTS personal_program_assignments_insert ON public.personal_program_assignments;
CREATE POLICY personal_program_assignments_insert ON public.personal_program_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = (SELECT auth.uid())
    AND program_block_id IN (
      SELECT id FROM public.program_blocks
      WHERE owner_profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS personal_program_assignments_update ON public.personal_program_assignments;
CREATE POLICY personal_program_assignments_update ON public.personal_program_assignments
  FOR UPDATE TO authenticated
  USING (profile_id = (SELECT auth.uid()))
  WITH CHECK (
    profile_id = (SELECT auth.uid())
    AND program_block_id IN (
      SELECT id FROM public.program_blocks
      WHERE owner_profile_id = (SELECT auth.uid())
    )
  );
