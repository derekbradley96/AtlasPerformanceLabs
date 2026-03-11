-- Client-specific supplement prescriptions: link clients to supplements with dosage/timing.

CREATE TABLE IF NOT EXISTS public.client_supplements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  supplement_id UUID NOT NULL REFERENCES public.supplements(id) ON DELETE CASCADE,
  dosage TEXT,
  timing TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_supplements_client_id ON public.client_supplements (client_id);
CREATE INDEX IF NOT EXISTS idx_client_supplements_supplement_id ON public.client_supplements (supplement_id);
CREATE INDEX IF NOT EXISTS idx_client_supplements_created_at ON public.client_supplements (created_at DESC);

COMMENT ON TABLE public.client_supplements IS 'Per-client supplement prescriptions, including dosage, timing, and notes.';

ALTER TABLE public.client_supplements ENABLE ROW LEVEL SECURITY;

-- Coach: manage supplements for their clients
DROP POLICY IF EXISTS client_supplements_coach_all ON public.client_supplements;
CREATE POLICY client_supplements_coach_all ON public.client_supplements
  USING (client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid() OR trainer_id = auth.uid()))
  WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid() OR trainer_id = auth.uid()));

-- Client: manage their own supplements (via clients.user_id)
DROP POLICY IF EXISTS client_supplements_client_all ON public.client_supplements;
CREATE POLICY client_supplements_client_all ON public.client_supplements
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()))
  WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

