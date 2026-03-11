-- Atlas Momentum scoring system: weekly adherence scores per client.
-- Ownership: coach via clients.coach_id; client via clients.user_id.

CREATE TABLE IF NOT EXISTS public.client_momentum_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  training_score NUMERIC,
  nutrition_score NUMERIC,
  steps_score NUMERIC,
  sleep_score NUMERIC,
  checkin_score NUMERIC,
  total_score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_momentum_scores_client_week
  ON public.client_momentum_scores(client_id, week_start);
CREATE INDEX IF NOT EXISTS idx_client_momentum_scores_client
  ON public.client_momentum_scores(client_id);
CREATE INDEX IF NOT EXISTS idx_client_momentum_scores_week_start
  ON public.client_momentum_scores(week_start DESC);

COMMENT ON TABLE public.client_momentum_scores IS 'Atlas Momentum: weekly adherence scores (training, nutrition, steps, sleep, checkin, total) per client.';

ALTER TABLE public.client_momentum_scores ENABLE ROW LEVEL SECURITY;

-- Coach: full access for their clients
DROP POLICY IF EXISTS client_momentum_scores_select_coach ON public.client_momentum_scores;
DROP POLICY IF EXISTS client_momentum_scores_insert_coach ON public.client_momentum_scores;
DROP POLICY IF EXISTS client_momentum_scores_update_coach ON public.client_momentum_scores;
DROP POLICY IF EXISTS client_momentum_scores_delete_coach ON public.client_momentum_scores;

CREATE POLICY client_momentum_scores_select_coach ON public.client_momentum_scores FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_momentum_scores.client_id AND c.coach_id = auth.uid())
);
CREATE POLICY client_momentum_scores_insert_coach ON public.client_momentum_scores FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_momentum_scores.client_id AND c.coach_id = auth.uid())
);
CREATE POLICY client_momentum_scores_update_coach ON public.client_momentum_scores FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_momentum_scores.client_id AND c.coach_id = auth.uid())
);
CREATE POLICY client_momentum_scores_delete_coach ON public.client_momentum_scores FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_momentum_scores.client_id AND c.coach_id = auth.uid())
);

-- Client: full access for own record (via clients.user_id)
DROP POLICY IF EXISTS client_momentum_scores_select_client ON public.client_momentum_scores;
DROP POLICY IF EXISTS client_momentum_scores_insert_client ON public.client_momentum_scores;
DROP POLICY IF EXISTS client_momentum_scores_update_client ON public.client_momentum_scores;
DROP POLICY IF EXISTS client_momentum_scores_delete_client ON public.client_momentum_scores;

CREATE POLICY client_momentum_scores_select_client ON public.client_momentum_scores FOR SELECT USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);
CREATE POLICY client_momentum_scores_insert_client ON public.client_momentum_scores FOR INSERT WITH CHECK (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);
CREATE POLICY client_momentum_scores_update_client ON public.client_momentum_scores FOR UPDATE USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);
CREATE POLICY client_momentum_scores_delete_client ON public.client_momentum_scores FOR DELETE USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);
