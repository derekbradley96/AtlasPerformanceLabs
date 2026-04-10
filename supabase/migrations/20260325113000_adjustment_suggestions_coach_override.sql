-- Coach override layer: suggestions are visible/reviewable/controllable before apply.

CREATE TABLE IF NOT EXISTS public.adjustment_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('volume', 'rest', 'deload', 'nutrition')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT,
  confidence_score NUMERIC NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'ignored', 'modified')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adjustment_suggestions_coach_status_created
  ON public.adjustment_suggestions(coach_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_adjustment_suggestions_client_status_created
  ON public.adjustment_suggestions(client_id, status, created_at DESC);

ALTER TABLE public.adjustment_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS adjustment_suggestions_select_coach_client ON public.adjustment_suggestions;
CREATE POLICY adjustment_suggestions_select_coach_client
  ON public.adjustment_suggestions
  FOR SELECT
  USING (
    auth.uid() = coach_id
    OR EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = adjustment_suggestions.client_id
        AND (c.user_id = auth.uid() OR c.coach_id = auth.uid() OR c.trainer_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS adjustment_suggestions_insert_coach ON public.adjustment_suggestions;
CREATE POLICY adjustment_suggestions_insert_coach
  ON public.adjustment_suggestions
  FOR INSERT
  WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS adjustment_suggestions_update_coach ON public.adjustment_suggestions;
CREATE POLICY adjustment_suggestions_update_coach
  ON public.adjustment_suggestions
  FOR UPDATE
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);
