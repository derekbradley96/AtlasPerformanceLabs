-- Extend client_state for coaching intelligence and attention queue.
-- Adds: risk_level, engagement_score, progress_score, last_program_update_at, compliance_score.
-- Does not drop or alter existing columns or triggers.

-- 1) Add columns if they do not exist
ALTER TABLE public.client_state
  ADD COLUMN IF NOT EXISTS risk_level TEXT,
  ADD COLUMN IF NOT EXISTS engagement_score NUMERIC,
  ADD COLUMN IF NOT EXISTS progress_score NUMERIC,
  ADD COLUMN IF NOT EXISTS last_program_update_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS compliance_score NUMERIC;

-- 2) Check constraint for risk_level (low, medium, high)
ALTER TABLE public.client_state
  DROP CONSTRAINT IF EXISTS client_state_risk_level_check;

ALTER TABLE public.client_state
  ADD CONSTRAINT client_state_risk_level_check
  CHECK (risk_level IS NULL OR LOWER(TRIM(risk_level)) IN ('low', 'medium', 'high'));

-- 3) Indexes (create only if not exists)
CREATE INDEX IF NOT EXISTS client_state_risk_level_idx
  ON public.client_state(risk_level)
  WHERE risk_level IS NOT NULL;

CREATE INDEX IF NOT EXISTS client_state_last_checkin_idx
  ON public.client_state(last_checkin_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS client_state_engagement_score_idx
  ON public.client_state(engagement_score DESC NULLS LAST)
  WHERE engagement_score IS NOT NULL;

-- 4) Comment
COMMENT ON COLUMN public.client_state.risk_level IS 'Coaching intelligence risk: low | medium | high. For attention queue.';
COMMENT ON COLUMN public.client_state.engagement_score IS 'Derived engagement score (e.g. 0–100). For ranking and attention.';
COMMENT ON COLUMN public.client_state.progress_score IS 'Derived progress score (e.g. 0–100). For coaching intelligence.';
COMMENT ON COLUMN public.client_state.last_program_update_at IS 'When the client''s program was last updated. For staleness and attention.';
COMMENT ON COLUMN public.client_state.compliance_score IS 'Compliance score (e.g. 0–100). May mirror or supplement current_compliance.';
