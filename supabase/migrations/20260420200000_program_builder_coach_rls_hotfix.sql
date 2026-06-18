-- Program Builder coach RLS hotfix:
-- Restore explicit coach CRUD policies for program builder tables after policy cleanup.
-- Keep client/personal policies intact; these are additive permissive policies.

-- ---------------------------------------------------------------------------
-- program_blocks
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS program_blocks_select_coach_scope ON public.program_blocks;
CREATE POLICY program_blocks_select_coach_scope ON public.program_blocks
  FOR SELECT TO authenticated
  USING (
    coach_id = auth.uid()
    OR client_id IN (
      SELECT c.id
      FROM public.clients c
      WHERE COALESCE(c.coach_id, c.trainer_id) = auth.uid()
    )
  );

DROP POLICY IF EXISTS program_blocks_insert_coach_scope ON public.program_blocks;
CREATE POLICY program_blocks_insert_coach_scope ON public.program_blocks
  FOR INSERT TO authenticated
  WITH CHECK (
    coach_id = auth.uid()
    AND (
      client_id IS NULL
      OR client_id IN (
        SELECT c.id
        FROM public.clients c
        WHERE COALESCE(c.coach_id, c.trainer_id) = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS program_blocks_update_coach_scope ON public.program_blocks;
CREATE POLICY program_blocks_update_coach_scope ON public.program_blocks
  FOR UPDATE TO authenticated
  USING (
    coach_id = auth.uid()
    OR client_id IN (
      SELECT c.id
      FROM public.clients c
      WHERE COALESCE(c.coach_id, c.trainer_id) = auth.uid()
    )
  )
  WITH CHECK (
    coach_id = auth.uid()
    OR client_id IN (
      SELECT c.id
      FROM public.clients c
      WHERE COALESCE(c.coach_id, c.trainer_id) = auth.uid()
    )
  );

DROP POLICY IF EXISTS program_blocks_delete_coach_scope ON public.program_blocks;
CREATE POLICY program_blocks_delete_coach_scope ON public.program_blocks
  FOR DELETE TO authenticated
  USING (
    coach_id = auth.uid()
    OR client_id IN (
      SELECT c.id
      FROM public.clients c
      WHERE COALESCE(c.coach_id, c.trainer_id) = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- program_weeks
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS program_weeks_select_coach_scope ON public.program_weeks;
CREATE POLICY program_weeks_select_coach_scope ON public.program_weeks
  FOR SELECT TO authenticated
  USING (
    block_id IN (
      SELECT pb.id
      FROM public.program_blocks pb
      WHERE pb.coach_id = auth.uid()
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c WHERE COALESCE(c.coach_id, c.trainer_id) = auth.uid()
         )
    )
  );

DROP POLICY IF EXISTS program_weeks_insert_coach_scope ON public.program_weeks;
CREATE POLICY program_weeks_insert_coach_scope ON public.program_weeks
  FOR INSERT TO authenticated
  WITH CHECK (
    block_id IN (
      SELECT pb.id
      FROM public.program_blocks pb
      WHERE pb.coach_id = auth.uid()
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c WHERE COALESCE(c.coach_id, c.trainer_id) = auth.uid()
         )
    )
  );

DROP POLICY IF EXISTS program_weeks_update_coach_scope ON public.program_weeks;
CREATE POLICY program_weeks_update_coach_scope ON public.program_weeks
  FOR UPDATE TO authenticated
  USING (
    block_id IN (
      SELECT pb.id
      FROM public.program_blocks pb
      WHERE pb.coach_id = auth.uid()
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c WHERE COALESCE(c.coach_id, c.trainer_id) = auth.uid()
         )
    )
  )
  WITH CHECK (
    block_id IN (
      SELECT pb.id
      FROM public.program_blocks pb
      WHERE pb.coach_id = auth.uid()
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c WHERE COALESCE(c.coach_id, c.trainer_id) = auth.uid()
         )
    )
  );

DROP POLICY IF EXISTS program_weeks_delete_coach_scope ON public.program_weeks;
CREATE POLICY program_weeks_delete_coach_scope ON public.program_weeks
  FOR DELETE TO authenticated
  USING (
    block_id IN (
      SELECT pb.id
      FROM public.program_blocks pb
      WHERE pb.coach_id = auth.uid()
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c WHERE COALESCE(c.coach_id, c.trainer_id) = auth.uid()
         )
    )
  );

-- ---------------------------------------------------------------------------
-- program_days
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS program_days_select_coach_scope ON public.program_days;
CREATE POLICY program_days_select_coach_scope ON public.program_days
  FOR SELECT TO authenticated
  USING (
    week_id IN (
      SELECT pw.id
      FROM public.program_weeks pw
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.coach_id = auth.uid()
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c WHERE COALESCE(c.coach_id, c.trainer_id) = auth.uid()
         )
    )
  );

DROP POLICY IF EXISTS program_days_insert_coach_scope ON public.program_days;
CREATE POLICY program_days_insert_coach_scope ON public.program_days
  FOR INSERT TO authenticated
  WITH CHECK (
    week_id IN (
      SELECT pw.id
      FROM public.program_weeks pw
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.coach_id = auth.uid()
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c WHERE COALESCE(c.coach_id, c.trainer_id) = auth.uid()
         )
    )
  );

DROP POLICY IF EXISTS program_days_update_coach_scope ON public.program_days;
CREATE POLICY program_days_update_coach_scope ON public.program_days
  FOR UPDATE TO authenticated
  USING (
    week_id IN (
      SELECT pw.id
      FROM public.program_weeks pw
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.coach_id = auth.uid()
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c WHERE COALESCE(c.coach_id, c.trainer_id) = auth.uid()
         )
    )
  )
  WITH CHECK (
    week_id IN (
      SELECT pw.id
      FROM public.program_weeks pw
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.coach_id = auth.uid()
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c WHERE COALESCE(c.coach_id, c.trainer_id) = auth.uid()
         )
    )
  );

DROP POLICY IF EXISTS program_days_delete_coach_scope ON public.program_days;
CREATE POLICY program_days_delete_coach_scope ON public.program_days
  FOR DELETE TO authenticated
  USING (
    week_id IN (
      SELECT pw.id
      FROM public.program_weeks pw
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.coach_id = auth.uid()
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c WHERE COALESCE(c.coach_id, c.trainer_id) = auth.uid()
         )
    )
  );

-- ---------------------------------------------------------------------------
-- program_exercises
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS program_exercises_select_coach_scope ON public.program_exercises;
CREATE POLICY program_exercises_select_coach_scope ON public.program_exercises
  FOR SELECT TO authenticated
  USING (
    day_id IN (
      SELECT pd.id
      FROM public.program_days pd
      JOIN public.program_weeks pw ON pw.id = pd.week_id
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.coach_id = auth.uid()
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c WHERE COALESCE(c.coach_id, c.trainer_id) = auth.uid()
         )
    )
  );

DROP POLICY IF EXISTS program_exercises_insert_coach_scope ON public.program_exercises;
CREATE POLICY program_exercises_insert_coach_scope ON public.program_exercises
  FOR INSERT TO authenticated
  WITH CHECK (
    day_id IN (
      SELECT pd.id
      FROM public.program_days pd
      JOIN public.program_weeks pw ON pw.id = pd.week_id
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.coach_id = auth.uid()
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c WHERE COALESCE(c.coach_id, c.trainer_id) = auth.uid()
         )
    )
  );

DROP POLICY IF EXISTS program_exercises_update_coach_scope ON public.program_exercises;
CREATE POLICY program_exercises_update_coach_scope ON public.program_exercises
  FOR UPDATE TO authenticated
  USING (
    day_id IN (
      SELECT pd.id
      FROM public.program_days pd
      JOIN public.program_weeks pw ON pw.id = pd.week_id
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.coach_id = auth.uid()
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c WHERE COALESCE(c.coach_id, c.trainer_id) = auth.uid()
         )
    )
  )
  WITH CHECK (
    day_id IN (
      SELECT pd.id
      FROM public.program_days pd
      JOIN public.program_weeks pw ON pw.id = pd.week_id
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.coach_id = auth.uid()
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c WHERE COALESCE(c.coach_id, c.trainer_id) = auth.uid()
         )
    )
  );

DROP POLICY IF EXISTS program_exercises_delete_coach_scope ON public.program_exercises;
CREATE POLICY program_exercises_delete_coach_scope ON public.program_exercises
  FOR DELETE TO authenticated
  USING (
    day_id IN (
      SELECT pd.id
      FROM public.program_days pd
      JOIN public.program_weeks pw ON pw.id = pd.week_id
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.coach_id = auth.uid()
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c WHERE COALESCE(c.coach_id, c.trainer_id) = auth.uid()
         )
    )
  );

-- ---------------------------------------------------------------------------
-- program_block_assignments
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS program_block_assignments_select_coach_scope ON public.program_block_assignments;
CREATE POLICY program_block_assignments_select_coach_scope ON public.program_block_assignments
  FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT c.id FROM public.clients c WHERE COALESCE(c.coach_id, c.trainer_id) = auth.uid()
    )
    OR program_block_id IN (
      SELECT pb.id
      FROM public.program_blocks pb
      WHERE pb.coach_id = auth.uid()
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c WHERE COALESCE(c.coach_id, c.trainer_id) = auth.uid()
         )
    )
  );

DROP POLICY IF EXISTS program_block_assignments_insert_coach_scope ON public.program_block_assignments;
CREATE POLICY program_block_assignments_insert_coach_scope ON public.program_block_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT c.id FROM public.clients c WHERE COALESCE(c.coach_id, c.trainer_id) = auth.uid()
    )
    AND program_block_id IN (
      SELECT pb.id
      FROM public.program_blocks pb
      WHERE pb.coach_id = auth.uid()
         OR pb.client_id IN (
           SELECT c.id FROM public.clients c WHERE COALESCE(c.coach_id, c.trainer_id) = auth.uid()
         )
    )
  );

DROP POLICY IF EXISTS program_block_assignments_update_coach_scope ON public.program_block_assignments;
CREATE POLICY program_block_assignments_update_coach_scope ON public.program_block_assignments
  FOR UPDATE TO authenticated
  USING (
    client_id IN (
      SELECT c.id FROM public.clients c WHERE COALESCE(c.coach_id, c.trainer_id) = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT c.id FROM public.clients c WHERE COALESCE(c.coach_id, c.trainer_id) = auth.uid()
    )
  );

DROP POLICY IF EXISTS program_block_assignments_delete_coach_scope ON public.program_block_assignments;
CREATE POLICY program_block_assignments_delete_coach_scope ON public.program_block_assignments
  FOR DELETE TO authenticated
  USING (
    client_id IN (
      SELECT c.id FROM public.clients c WHERE COALESCE(c.coach_id, c.trainer_id) = auth.uid()
    )
  );
