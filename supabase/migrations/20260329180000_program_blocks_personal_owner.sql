-- Personal users: own program_blocks without a clients row (owner_profile_id).
-- Assignments: personal_program_assignments links profile to active block.

ALTER TABLE public.program_blocks
  ADD COLUMN IF NOT EXISTS owner_profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.program_blocks
  ALTER COLUMN client_id DROP NOT NULL;

ALTER TABLE public.program_blocks DROP CONSTRAINT IF EXISTS program_blocks_owner_xor_client;
ALTER TABLE public.program_blocks ADD CONSTRAINT program_blocks_owner_xor_client CHECK (
  (owner_profile_id IS NOT NULL AND client_id IS NULL)
  OR (owner_profile_id IS NULL AND client_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_program_blocks_owner_profile_id
  ON public.program_blocks(owner_profile_id)
  WHERE owner_profile_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- personal_program_assignments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.personal_program_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  program_block_id UUID NOT NULL REFERENCES public.program_blocks(id) ON DELETE CASCADE,
  start_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personal_program_assignments_profile
  ON public.personal_program_assignments(profile_id);
CREATE INDEX IF NOT EXISTS idx_personal_program_assignments_block
  ON public.personal_program_assignments(program_block_id);

CREATE UNIQUE INDEX IF NOT EXISTS personal_program_assignments_one_active_per_profile
  ON public.personal_program_assignments(profile_id)
  WHERE is_active = true;

ALTER TABLE public.personal_program_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS personal_program_assignments_select_own ON public.personal_program_assignments;
CREATE POLICY personal_program_assignments_select_own ON public.personal_program_assignments
  FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS personal_program_assignments_insert_own ON public.personal_program_assignments;
CREATE POLICY personal_program_assignments_insert_own ON public.personal_program_assignments
  FOR INSERT WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS personal_program_assignments_update_own ON public.personal_program_assignments;
CREATE POLICY personal_program_assignments_update_own ON public.personal_program_assignments
  FOR UPDATE USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS personal_program_assignments_delete_own ON public.personal_program_assignments;
CREATE POLICY personal_program_assignments_delete_own ON public.personal_program_assignments
  FOR DELETE USING (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RLS: personal owner can CRUD their blocks and nested rows
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS program_blocks_select_personal_owner ON public.program_blocks;
CREATE POLICY program_blocks_select_personal_owner ON public.program_blocks
  FOR SELECT USING (owner_profile_id = auth.uid());

DROP POLICY IF EXISTS program_blocks_insert_personal_owner ON public.program_blocks;
CREATE POLICY program_blocks_insert_personal_owner ON public.program_blocks
  FOR INSERT WITH CHECK (owner_profile_id = auth.uid() AND client_id IS NULL);

DROP POLICY IF EXISTS program_blocks_update_personal_owner ON public.program_blocks;
CREATE POLICY program_blocks_update_personal_owner ON public.program_blocks
  FOR UPDATE USING (owner_profile_id = auth.uid())
  WITH CHECK (owner_profile_id = auth.uid() AND client_id IS NULL);

DROP POLICY IF EXISTS program_blocks_delete_personal_owner ON public.program_blocks;
CREATE POLICY program_blocks_delete_personal_owner ON public.program_blocks
  FOR DELETE USING (owner_profile_id = auth.uid());

DROP POLICY IF EXISTS program_weeks_select_personal_owner ON public.program_weeks;
CREATE POLICY program_weeks_select_personal_owner ON public.program_weeks
  FOR SELECT USING (
    block_id IN (SELECT id FROM public.program_blocks WHERE owner_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS program_weeks_insert_personal_owner ON public.program_weeks;
CREATE POLICY program_weeks_insert_personal_owner ON public.program_weeks
  FOR INSERT WITH CHECK (
    block_id IN (SELECT id FROM public.program_blocks WHERE owner_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS program_weeks_update_personal_owner ON public.program_weeks;
CREATE POLICY program_weeks_update_personal_owner ON public.program_weeks
  FOR UPDATE USING (
    block_id IN (SELECT id FROM public.program_blocks WHERE owner_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS program_weeks_delete_personal_owner ON public.program_weeks;
CREATE POLICY program_weeks_delete_personal_owner ON public.program_weeks
  FOR DELETE USING (
    block_id IN (SELECT id FROM public.program_blocks WHERE owner_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS program_days_select_personal_owner ON public.program_days;
CREATE POLICY program_days_select_personal_owner ON public.program_days
  FOR SELECT USING (
    week_id IN (
      SELECT pw.id FROM public.program_weeks pw
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.owner_profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS program_days_insert_personal_owner ON public.program_days;
CREATE POLICY program_days_insert_personal_owner ON public.program_days
  FOR INSERT WITH CHECK (
    week_id IN (
      SELECT pw.id FROM public.program_weeks pw
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.owner_profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS program_days_update_personal_owner ON public.program_days;
CREATE POLICY program_days_update_personal_owner ON public.program_days
  FOR UPDATE USING (
    week_id IN (
      SELECT pw.id FROM public.program_weeks pw
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.owner_profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS program_days_delete_personal_owner ON public.program_days;
CREATE POLICY program_days_delete_personal_owner ON public.program_days
  FOR DELETE USING (
    week_id IN (
      SELECT pw.id FROM public.program_weeks pw
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.owner_profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS program_exercises_select_personal_owner ON public.program_exercises;
CREATE POLICY program_exercises_select_personal_owner ON public.program_exercises
  FOR SELECT USING (
    day_id IN (
      SELECT pd.id FROM public.program_days pd
      JOIN public.program_weeks pw ON pw.id = pd.week_id
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.owner_profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS program_exercises_insert_personal_owner ON public.program_exercises;
CREATE POLICY program_exercises_insert_personal_owner ON public.program_exercises
  FOR INSERT WITH CHECK (
    day_id IN (
      SELECT pd.id FROM public.program_days pd
      JOIN public.program_weeks pw ON pw.id = pd.week_id
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.owner_profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS program_exercises_update_personal_owner ON public.program_exercises;
CREATE POLICY program_exercises_update_personal_owner ON public.program_exercises
  FOR UPDATE USING (
    day_id IN (
      SELECT pd.id FROM public.program_days pd
      JOIN public.program_weeks pw ON pw.id = pd.week_id
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.owner_profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS program_exercises_delete_personal_owner ON public.program_exercises;
CREATE POLICY program_exercises_delete_personal_owner ON public.program_exercises
  FOR DELETE USING (
    day_id IN (
      SELECT pd.id FROM public.program_days pd
      JOIN public.program_weeks pw ON pw.id = pd.week_id
      JOIN public.program_blocks pb ON pb.id = pw.block_id
      WHERE pb.owner_profile_id = auth.uid()
    )
  );

COMMENT ON COLUMN public.program_blocks.owner_profile_id IS 'When set, block is owned by a personal (solo) user; client_id must be null.';
COMMENT ON TABLE public.personal_program_assignments IS 'Active program block for a personal profile (replaces coach client assignment).';
