-- Allow clients to read their own assigned program block and exercise structure.
-- This fixes client Today/Program views that rely on program_block_assignments + program_* tables.

-- program_block_assignments: client can read rows for their own client profile
DROP POLICY IF EXISTS program_block_assignments_select_client ON public.program_block_assignments;
CREATE POLICY program_block_assignments_select_client ON public.program_block_assignments
  FOR SELECT USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

-- program_blocks: client can read blocks linked to their own client profile
DROP POLICY IF EXISTS program_blocks_select_client ON public.program_blocks;
CREATE POLICY program_blocks_select_client ON public.program_blocks
  FOR SELECT USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

-- program_weeks: client can read weeks for their own blocks
DROP POLICY IF EXISTS program_weeks_select_client ON public.program_weeks;
CREATE POLICY program_weeks_select_client ON public.program_weeks
  FOR SELECT USING (
    block_id IN (
      SELECT id FROM public.program_blocks
      WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    )
  );

-- program_days: client can read days for their own blocks
DROP POLICY IF EXISTS program_days_select_client ON public.program_days;
CREATE POLICY program_days_select_client ON public.program_days
  FOR SELECT USING (
    week_id IN (
      SELECT pw.id
      FROM public.program_weeks pw
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    )
  );

-- program_exercises: client can read exercises for their own blocks
DROP POLICY IF EXISTS program_exercises_select_client ON public.program_exercises;
CREATE POLICY program_exercises_select_client ON public.program_exercises
  FOR SELECT USING (
    day_id IN (
      SELECT pd.id
      FROM public.program_days pd
      JOIN public.program_weeks pw ON pw.id = pd.week_id
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    )
  );
