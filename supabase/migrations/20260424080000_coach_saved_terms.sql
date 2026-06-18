-- Coach free-text memory: reusable terms per category (no client data here).

CREATE TABLE IF NOT EXISTS public.coach_saved_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  term TEXT NOT NULL,
  use_count INTEGER NOT NULL DEFAULT 1,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coach_id, category, term)
);

CREATE INDEX IF NOT EXISTS idx_coach_saved_terms_coach_cat
  ON public.coach_saved_terms (coach_id, category);

CREATE INDEX IF NOT EXISTS idx_coach_saved_terms_use_count
  ON public.coach_saved_terms (coach_id, category, use_count DESC);

ALTER TABLE public.coach_saved_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_saved_terms_own ON public.coach_saved_terms;

CREATE POLICY coach_saved_terms_own
  ON public.coach_saved_terms
  FOR ALL
  TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

COMMENT ON TABLE public.coach_saved_terms IS 'Coach-only remembered free-text tokens per category; RLS scoped to auth.uid() as coach_id.';
