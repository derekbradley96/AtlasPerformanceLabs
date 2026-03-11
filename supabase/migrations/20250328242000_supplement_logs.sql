-- Supplement adherence logs: per-day records of whether a client took a prescribed supplement.

CREATE TABLE IF NOT EXISTS public.supplement_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_supplement_id UUID NOT NULL REFERENCES public.client_supplements(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  taken BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplement_logs_client_supplement_id ON public.supplement_logs (client_supplement_id);
CREATE INDEX IF NOT EXISTS idx_supplement_logs_log_date ON public.supplement_logs (log_date);
CREATE INDEX IF NOT EXISTS idx_supplement_logs_created_at ON public.supplement_logs (created_at DESC);

COMMENT ON TABLE public.supplement_logs IS 'Per-day supplement adherence logs linked to client_supplements.';

ALTER TABLE public.supplement_logs ENABLE ROW LEVEL SECURITY;

-- Coach: view/manage logs for their clients via client_supplements → clients
DROP POLICY IF EXISTS supplement_logs_coach_all ON public.supplement_logs;
CREATE POLICY supplement_logs_coach_all ON public.supplement_logs
  USING (
    client_supplement_id IN (
      SELECT cs.id
      FROM public.client_supplements cs
      JOIN public.clients c ON c.id = cs.client_id
      WHERE c.coach_id = auth.uid() OR c.trainer_id = auth.uid()
    )
  )
  WITH CHECK (
    client_supplement_id IN (
      SELECT cs.id
      FROM public.client_supplements cs
      JOIN public.clients c ON c.id = cs.client_id
      WHERE c.coach_id = auth.uid() OR c.trainer_id = auth.uid()
    )
  );

-- Client: view/manage their own logs via clients.user_id
DROP POLICY IF EXISTS supplement_logs_client_all ON public.supplement_logs;
CREATE POLICY supplement_logs_client_all ON public.supplement_logs
  USING (
    client_supplement_id IN (
      SELECT cs.id
      FROM public.client_supplements cs
      JOIN public.clients c ON c.id = cs.client_id
      WHERE c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    client_supplement_id IN (
      SELECT cs.id
      FROM public.client_supplements cs
      JOIN public.clients c ON c.id = cs.client_id
      WHERE c.user_id = auth.uid()
    )
  );

