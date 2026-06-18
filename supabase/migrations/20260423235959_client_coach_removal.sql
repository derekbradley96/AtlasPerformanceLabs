-- Track coach-client relationship endings
CREATE TABLE IF NOT EXISTS public.client_coach_removals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL,
  initiated_by TEXT NOT NULL CHECK (initiated_by IN ('coach', 'client')),
  reason TEXT NOT NULL,
  reason_detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_coach_removals_client
  ON public.client_coach_removals (client_id);

CREATE INDEX IF NOT EXISTS idx_client_coach_removals_coach
  ON public.client_coach_removals (coach_id);

ALTER TABLE public.client_coach_removals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_coach_removals_coach ON public.client_coach_removals;
CREATE POLICY client_coach_removals_coach
  ON public.client_coach_removals
  FOR ALL
  TO authenticated
  USING (coach_id = (SELECT auth.uid()))
  WITH CHECK (coach_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS client_coach_removals_client ON public.client_coach_removals;
CREATE POLICY client_coach_removals_client
  ON public.client_coach_removals
  FOR ALL
  TO authenticated
  USING (
    client_id IN (
      SELECT id
      FROM public.clients
      WHERE user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id
      FROM public.clients
      WHERE user_id = (SELECT auth.uid())
    )
  );
