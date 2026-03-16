-- Idempotency for Stripe webhooks: record processed event IDs to avoid duplicate processing on retries.
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stripe_webhook_events_processed_at_idx ON public.stripe_webhook_events(processed_at);

COMMENT ON TABLE public.stripe_webhook_events IS 'Stripe webhook event IDs already processed; used for idempotent handling.';

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- No policies: anon/authenticated cannot access. Edge Functions use service_role which bypasses RLS.
