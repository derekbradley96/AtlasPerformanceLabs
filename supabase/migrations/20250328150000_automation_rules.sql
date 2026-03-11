-- Automation rules: trigger + condition (jsonb) + action type for coach/automation engine.
-- RLS enabled with no policies until ownership column (e.g. coach_id) is added; service_role bypasses RLS.

CREATE TABLE IF NOT EXISTS public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type TEXT,
  condition JSONB,
  action_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger_type
  ON public.automation_rules (trigger_type);
CREATE INDEX IF NOT EXISTS idx_automation_rules_action_type
  ON public.automation_rules (action_type);
CREATE INDEX IF NOT EXISTS idx_automation_rules_created_at
  ON public.automation_rules (created_at DESC);

COMMENT ON TABLE public.automation_rules IS 'Automation rules: trigger_type, condition JSON, action_type; evaluated by backend/cron.';
COMMENT ON COLUMN public.automation_rules.trigger_type IS 'Event or schedule key that starts evaluation.';
COMMENT ON COLUMN public.automation_rules.condition IS 'JSONB predicates/parameters for when the action runs.';
COMMENT ON COLUMN public.automation_rules.action_type IS 'Action to perform when condition matches (e.g. notify, tag).';

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

-- No policies yet: only service_role / table owner can read/write until scoped by coach or role.
