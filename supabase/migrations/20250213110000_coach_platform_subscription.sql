-- Coach platform subscription (Basic/Pro/Elite). Stripe Customer + subscription status.
ALTER TABLE atlas_coaches
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_atlas_coaches_stripe_customer_id
  ON atlas_coaches(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

COMMENT ON COLUMN atlas_coaches.subscription_status IS 'Platform plan: active, past_due, canceled, trialing';
COMMENT ON COLUMN atlas_coaches.current_period_end IS 'End of current billing period (platform plan)';
