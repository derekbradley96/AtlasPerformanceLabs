-- Store Atlas platform fee per paid invoice (calculated in stripe-webhook from coach_subscription_tiers).
CREATE TABLE IF NOT EXISTS atlas_invoice_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_invoice_id TEXT NOT NULL UNIQUE,
  stripe_subscription_id TEXT,
  coach_id UUID NOT NULL REFERENCES atlas_coaches(id) ON DELETE CASCADE,
  amount_paid_cents BIGINT NOT NULL,
  platform_fee_cents BIGINT NOT NULL,
  coach_amount_cents BIGINT NOT NULL,
  commission_rate NUMERIC(5, 4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atlas_invoice_fees_coach_id ON atlas_invoice_fees(coach_id);
CREATE INDEX IF NOT EXISTS idx_atlas_invoice_fees_stripe_invoice_id ON atlas_invoice_fees(stripe_invoice_id);

COMMENT ON TABLE atlas_invoice_fees IS 'Atlas commission (platform fee) per paid Stripe invoice; populated by stripe-webhook from coach_subscription_tiers.';
