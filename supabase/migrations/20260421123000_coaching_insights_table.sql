-- Ensure coaching insights storage exists for server-side detector runs.
-- Keeps backward compatibility with existing coach dashboard fields.

CREATE TABLE IF NOT EXISTS public.coaching_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL,
  type text NOT NULL,
  insight_type text,
  severity text NOT NULL DEFAULT 'medium',
  message text,
  title text,
  description text,
  metadata jsonb,
  is_resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.coaching_insights
  ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.coaching_insights
  ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.coaching_insights
  ADD COLUMN IF NOT EXISTS insight_type text;
ALTER TABLE public.coaching_insights
  ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.coaching_insights
  ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.coaching_insights
  ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE public.coaching_insights
  ADD COLUMN IF NOT EXISTS is_resolved boolean NOT NULL DEFAULT false;
ALTER TABLE public.coaching_insights
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.coaching_insights
SET type = COALESCE(type, insight_type)
WHERE type IS NULL AND insight_type IS NOT NULL;

UPDATE public.coaching_insights
SET insight_type = COALESCE(insight_type, type)
WHERE insight_type IS NULL AND type IS NOT NULL;

UPDATE public.coaching_insights
SET message = COALESCE(message, description)
WHERE message IS NULL AND description IS NOT NULL;

UPDATE public.coaching_insights
SET description = COALESCE(description, message)
WHERE description IS NULL AND message IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coaching_insights_type_check'
      AND conrelid = 'public.coaching_insights'::regclass
  ) THEN
    ALTER TABLE public.coaching_insights
      ADD CONSTRAINT coaching_insights_type_check
      CHECK (type IN ('weight_plateau', 'engagement_drop', 'habit_adherence', 'prep_risk', 'checkin_overdue', 'program_stall'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coaching_insights_severity_check'
      AND conrelid = 'public.coaching_insights'::regclass
  ) THEN
    ALTER TABLE public.coaching_insights
      ADD CONSTRAINT coaching_insights_severity_check
      CHECK (severity IN ('low', 'medium', 'high'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS coaching_insights_coach_created_idx
  ON public.coaching_insights (coach_id, created_at DESC);

CREATE INDEX IF NOT EXISTS coaching_insights_client_created_idx
  ON public.coaching_insights (client_id, created_at DESC);

ALTER TABLE public.coaching_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coaching_insights_select_owner ON public.coaching_insights;
DROP POLICY IF EXISTS coaching_insights_select_coach_clients ON public.coaching_insights;
CREATE POLICY coaching_insights_select_coach_clients ON public.coaching_insights
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = coaching_insights.client_id
        AND c.coach_id = auth.uid()
    )
  );
