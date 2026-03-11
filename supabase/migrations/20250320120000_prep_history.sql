-- Prep Data Vault: historical prep outcomes for coaches to store and review.
-- Ownership: coach via clients.coach_id; client via clients.user_id.

CREATE TABLE IF NOT EXISTS public.prep_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contest_prep_id UUID REFERENCES public.contest_preps(id) ON DELETE SET NULL,
  show_name TEXT,
  show_date DATE,
  division TEXT,
  "placing" TEXT,
  stage_weight NUMERIC,
  peak_week_carbs INTEGER,
  peak_week_water NUMERIC,
  peak_week_sodium INTEGER,
  coach_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prep_outcomes_client
  ON public.prep_outcomes(client_id);
CREATE INDEX IF NOT EXISTS idx_prep_outcomes_contest_prep
  ON public.prep_outcomes(contest_prep_id);
CREATE INDEX IF NOT EXISTS idx_prep_outcomes_show_date
  ON public.prep_outcomes(show_date DESC NULLS LAST);

COMMENT ON TABLE public.prep_outcomes IS 'Prep Data Vault: historical prep outcomes (placing, stage weight, peak week numbers, coach notes).';

ALTER TABLE public.prep_outcomes ENABLE ROW LEVEL SECURITY;

-- Coach: full access for their clients
DROP POLICY IF EXISTS prep_outcomes_select_coach ON public.prep_outcomes;
DROP POLICY IF EXISTS prep_outcomes_insert_coach ON public.prep_outcomes;
DROP POLICY IF EXISTS prep_outcomes_update_coach ON public.prep_outcomes;
DROP POLICY IF EXISTS prep_outcomes_delete_coach ON public.prep_outcomes;

CREATE POLICY prep_outcomes_select_coach ON public.prep_outcomes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = prep_outcomes.client_id AND c.coach_id = auth.uid())
);
CREATE POLICY prep_outcomes_insert_coach ON public.prep_outcomes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = prep_outcomes.client_id AND c.coach_id = auth.uid())
);
CREATE POLICY prep_outcomes_update_coach ON public.prep_outcomes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = prep_outcomes.client_id AND c.coach_id = auth.uid())
);
CREATE POLICY prep_outcomes_delete_coach ON public.prep_outcomes FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = prep_outcomes.client_id AND c.coach_id = auth.uid())
);

-- Client: read-only for own outcomes
DROP POLICY IF EXISTS prep_outcomes_select_client ON public.prep_outcomes;

CREATE POLICY prep_outcomes_select_client ON public.prep_outcomes FOR SELECT USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);
