-- Fix program_blocks RLS so coaches can:
--   1) Read/write their own template blocks (coach_id = auth.uid(), client_id NULL)
--   2) Read/write client blocks they own (via clients.coach_id)
-- Previously only client_id-based SELECT existed, so templates were invisible to coaches.

-- program_blocks: coach owns by coach_id (covers templates + client programs)
DROP POLICY IF EXISTS program_blocks_select ON public.program_blocks;
CREATE POLICY program_blocks_select ON public.program_blocks
  FOR SELECT TO authenticated
  USING (
    coach_id = (SELECT auth.uid())
    OR client_id IN (SELECT id FROM public.clients WHERE coach_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS program_blocks_insert ON public.program_blocks;
CREATE POLICY program_blocks_insert ON public.program_blocks
  FOR INSERT TO authenticated
  WITH CHECK (
    coach_id = (SELECT auth.uid())
    OR client_id IN (SELECT id FROM public.clients WHERE coach_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS program_blocks_update ON public.program_blocks;
CREATE POLICY program_blocks_update ON public.program_blocks
  FOR UPDATE TO authenticated
  USING (
    coach_id = (SELECT auth.uid())
    OR client_id IN (SELECT id FROM public.clients WHERE coach_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    coach_id = (SELECT auth.uid())
    OR client_id IN (SELECT id FROM public.clients WHERE coach_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS program_blocks_delete ON public.program_blocks;
CREATE POLICY program_blocks_delete ON public.program_blocks
  FOR DELETE TO authenticated
  USING (
    coach_id = (SELECT auth.uid())
    OR client_id IN (SELECT id FROM public.clients WHERE coach_id = (SELECT auth.uid()))
  );

-- program_weeks: cascade from program_blocks coach ownership
DROP POLICY IF EXISTS program_weeks_select ON public.program_weeks;
CREATE POLICY program_weeks_select ON public.program_weeks
  FOR SELECT TO authenticated
  USING (
    block_id IN (
      SELECT id FROM public.program_blocks
      WHERE coach_id = (SELECT auth.uid())
        OR client_id IN (SELECT id FROM public.clients WHERE coach_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS program_weeks_insert ON public.program_weeks;
CREATE POLICY program_weeks_insert ON public.program_weeks
  FOR INSERT TO authenticated
  WITH CHECK (
    block_id IN (
      SELECT id FROM public.program_blocks
      WHERE coach_id = (SELECT auth.uid())
        OR client_id IN (SELECT id FROM public.clients WHERE coach_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS program_weeks_update ON public.program_weeks;
CREATE POLICY program_weeks_update ON public.program_weeks
  FOR UPDATE TO authenticated
  USING (
    block_id IN (
      SELECT id FROM public.program_blocks
      WHERE coach_id = (SELECT auth.uid())
        OR client_id IN (SELECT id FROM public.clients WHERE coach_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS program_weeks_delete ON public.program_weeks;
CREATE POLICY program_weeks_delete ON public.program_weeks
  FOR DELETE TO authenticated
  USING (
    block_id IN (
      SELECT id FROM public.program_blocks
      WHERE coach_id = (SELECT auth.uid())
        OR client_id IN (SELECT id FROM public.clients WHERE coach_id = (SELECT auth.uid()))
    )
  );

-- program_days: cascade
DROP POLICY IF EXISTS program_days_select ON public.program_days;
CREATE POLICY program_days_select ON public.program_days
  FOR SELECT TO authenticated
  USING (
    week_id IN (
      SELECT pw.id FROM public.program_weeks pw
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.coach_id = (SELECT auth.uid())
        OR pb.client_id IN (SELECT id FROM public.clients WHERE coach_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS program_days_insert ON public.program_days;
CREATE POLICY program_days_insert ON public.program_days
  FOR INSERT TO authenticated
  WITH CHECK (
    week_id IN (
      SELECT pw.id FROM public.program_weeks pw
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.coach_id = (SELECT auth.uid())
        OR pb.client_id IN (SELECT id FROM public.clients WHERE coach_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS program_days_update ON public.program_days;
CREATE POLICY program_days_update ON public.program_days
  FOR UPDATE TO authenticated
  USING (
    week_id IN (
      SELECT pw.id FROM public.program_weeks pw
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.coach_id = (SELECT auth.uid())
        OR pb.client_id IN (SELECT id FROM public.clients WHERE coach_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS program_days_delete ON public.program_days;
CREATE POLICY program_days_delete ON public.program_days
  FOR DELETE TO authenticated
  USING (
    week_id IN (
      SELECT pw.id FROM public.program_weeks pw
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.coach_id = (SELECT auth.uid())
        OR pb.client_id IN (SELECT id FROM public.clients WHERE coach_id = (SELECT auth.uid()))
    )
  );

-- program_exercises: cascade
DROP POLICY IF EXISTS program_exercises_select ON public.program_exercises;
CREATE POLICY program_exercises_select ON public.program_exercises
  FOR SELECT TO authenticated
  USING (
    day_id IN (
      SELECT pd.id FROM public.program_days pd
      JOIN public.program_weeks pw ON pw.id = pd.week_id
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.coach_id = (SELECT auth.uid())
        OR pb.client_id IN (SELECT id FROM public.clients WHERE coach_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS program_exercises_insert ON public.program_exercises;
CREATE POLICY program_exercises_insert ON public.program_exercises
  FOR INSERT TO authenticated
  WITH CHECK (
    day_id IN (
      SELECT pd.id FROM public.program_days pd
      JOIN public.program_weeks pw ON pw.id = pd.week_id
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.coach_id = (SELECT auth.uid())
        OR pb.client_id IN (SELECT id FROM public.clients WHERE coach_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS program_exercises_update ON public.program_exercises;
CREATE POLICY program_exercises_update ON public.program_exercises
  FOR UPDATE TO authenticated
  USING (
    day_id IN (
      SELECT pd.id FROM public.program_days pd
      JOIN public.program_weeks pw ON pw.id = pd.week_id
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.coach_id = (SELECT auth.uid())
        OR pb.client_id IN (SELECT id FROM public.clients WHERE coach_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS program_exercises_delete ON public.program_exercises;
CREATE POLICY program_exercises_delete ON public.program_exercises
  FOR DELETE TO authenticated
  USING (
    day_id IN (
      SELECT pd.id FROM public.program_days pd
      JOIN public.program_weeks pw ON pw.id = pd.week_id
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.coach_id = (SELECT auth.uid())
        OR pb.client_id IN (SELECT id FROM public.clients WHERE coach_id = (SELECT auth.uid()))
    )
  );
