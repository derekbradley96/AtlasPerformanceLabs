-- Supplements catalog: reusable supplement definitions coaches can attach to plans.

CREATE TABLE IF NOT EXISTS public.supplements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplements_name ON public.supplements (name);
CREATE INDEX IF NOT EXISTS idx_supplements_category ON public.supplements (category);
CREATE INDEX IF NOT EXISTS idx_supplements_created_at ON public.supplements (created_at DESC);

COMMENT ON TABLE public.supplements IS 'Canonical supplement definitions (name, description, category) for tracking and planning.';
COMMENT ON COLUMN public.supplements.category IS 'Optional grouping label, e.g. health, performance, recovery.';

ALTER TABLE public.supplements ENABLE ROW LEVEL SECURITY;

-- For now, no public RLS policies: access should go through service-role or future scoped policies.
