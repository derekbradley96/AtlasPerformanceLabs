-- Program block assignments: link a program_block to a client with start date and active flag.
-- One active assignment per client; assigning a new active one deactivates previous (app logic).
-- Existing program_assignments (program_id -> programs) remains for legacy; this table uses program_blocks.

CREATE TABLE IF NOT EXISTS public.program_block_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  program_block_id UUID NOT NULL REFERENCES public.program_blocks(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_program_block_assignments_client_id ON public.program_block_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_program_block_assignments_program_block_id ON public.program_block_assignments(program_block_id);
CREATE INDEX IF NOT EXISTS idx_program_block_assignments_client_active ON public.program_block_assignments(client_id) WHERE is_active = true;

ALTER TABLE public.program_block_assignments ENABLE ROW LEVEL SECURITY;

-- Coach can manage assignments only for their clients (coach_id = auth.uid()).
DROP POLICY IF EXISTS program_block_assignments_select ON public.program_block_assignments;
CREATE POLICY program_block_assignments_select ON public.program_block_assignments
  FOR SELECT USING (
    client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid())
  );

DROP POLICY IF EXISTS program_block_assignments_insert ON public.program_block_assignments;
CREATE POLICY program_block_assignments_insert ON public.program_block_assignments
  FOR INSERT WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid())
  );

DROP POLICY IF EXISTS program_block_assignments_update ON public.program_block_assignments;
CREATE POLICY program_block_assignments_update ON public.program_block_assignments
  FOR UPDATE USING (
    client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid())
  )
  WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid())
  );

DROP POLICY IF EXISTS program_block_assignments_delete ON public.program_block_assignments;
CREATE POLICY program_block_assignments_delete ON public.program_block_assignments
  FOR DELETE USING (
    client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid())
  );
