-- Reusable peak week templates (7-day protocol) per coach.

CREATE TABLE IF NOT EXISTS public.peak_week_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id)
    ON DELETE CASCADE,
  name TEXT NOT NULL,
  days JSONB NOT NULL DEFAULT '[]'::jsonb,
  division TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS peak_week_templates_coach_id_idx
  ON public.peak_week_templates(coach_id);

COMMENT ON TABLE public.peak_week_templates IS 'Coach-authored 7-day peak week templates (days JSON) for fast deploy to athletes.';

ALTER TABLE public.peak_week_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS peak_week_templates_coach ON public.peak_week_templates;
CREATE POLICY peak_week_templates_coach ON public.peak_week_templates
  FOR ALL TO authenticated
  USING (coach_id = (SELECT auth.uid()))
  WITH CHECK (coach_id = (SELECT auth.uid()));
