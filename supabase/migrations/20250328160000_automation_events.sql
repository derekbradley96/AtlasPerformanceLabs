-- Automation events: append-only log of trigger events with typed payload for rules engine.

CREATE TABLE IF NOT EXISTS public.automation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_events_event_type
  ON public.automation_events (event_type);
CREATE INDEX IF NOT EXISTS idx_automation_events_created_at
  ON public.automation_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_events_payload_gin
  ON public.automation_events USING GIN (payload)
  WHERE payload IS NOT NULL;

COMMENT ON TABLE public.automation_events IS 'Append-only automation trigger events; payload holds context for rule evaluation.';
COMMENT ON COLUMN public.automation_events.event_type IS 'Event key (e.g. checkin_submitted, billing_failed).';
COMMENT ON COLUMN public.automation_events.payload IS 'JSONB context: client_id, coach_id, etc.';

ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;

-- No policies yet: insert/read via service_role or future scoped policies.
