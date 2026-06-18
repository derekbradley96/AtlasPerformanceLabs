-- Posing practice logs for contest-prep clients (weekly volume + session detail).

CREATE TABLE IF NOT EXISTS public.posing_practice_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  poses_practiced TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS posing_practice_logs_client_logged_at_idx
  ON public.posing_practice_logs (client_id, logged_at DESC);

ALTER TABLE public.posing_practice_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS posing_practice_logs_insert_client ON public.posing_practice_logs;
CREATE POLICY posing_practice_logs_insert_client ON public.posing_practice_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    AND client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS posing_practice_logs_select_client ON public.posing_practice_logs;
CREATE POLICY posing_practice_logs_select_client ON public.posing_practice_logs
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS posing_practice_logs_select_coach ON public.posing_practice_logs;
CREATE POLICY posing_practice_logs_select_coach ON public.posing_practice_logs
  FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE COALESCE(coach_id, trainer_id) = auth.uid()
    )
  );

COMMENT ON TABLE public.posing_practice_logs IS 'Per-session posing minutes and optional pose tags for prep clients.';
