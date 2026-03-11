-- Platform usage analytics: store events for product/engagement metrics.
-- Events: client_created, program_assigned, checkin_reviewed, message_sent, workout_logged

CREATE TABLE IF NOT EXISTS public.platform_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_usage_events_event_name ON public.platform_usage_events (event_name);
CREATE INDEX IF NOT EXISTS idx_platform_usage_events_user_id ON public.platform_usage_events (user_id);
CREATE INDEX IF NOT EXISTS idx_platform_usage_events_created_at ON public.platform_usage_events (created_at DESC);

COMMENT ON TABLE public.platform_usage_events IS 'Platform usage events for analytics: client_created, program_assigned, checkin_reviewed, message_sent, workout_logged.';

ALTER TABLE public.platform_usage_events ENABLE ROW LEVEL SECURITY;

-- Users can insert their own events (user_id = auth.uid()); no read policy so only service/backend can aggregate.
DROP POLICY IF EXISTS platform_usage_events_insert_own ON public.platform_usage_events;
CREATE POLICY platform_usage_events_insert_own ON public.platform_usage_events
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Optional: allow users to read their own events for a future "my activity" view.
DROP POLICY IF EXISTS platform_usage_events_select_own ON public.platform_usage_events;
CREATE POLICY platform_usage_events_select_own ON public.platform_usage_events
  FOR SELECT USING (user_id = auth.uid());
