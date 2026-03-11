-- Stripe Connect + Services + Payments + Review items
-- Uses atlas_ prefix to avoid conflict with existing trainers/leads/clients if present.

-- coaches (1:1 with auth user; Stripe Connect account and capability flags)
CREATE TABLE IF NOT EXISTS atlas_coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  stripe_account_id TEXT,
  charges_enabled BOOLEAN DEFAULT FALSE,
  payouts_enabled BOOLEAN DEFAULT FALSE,
  plan_tier TEXT NOT NULL DEFAULT 'pro',
  timezone TEXT DEFAULT 'UTC',
  working_hours_json JSONB DEFAULT '{}',
  policies_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_atlas_coaches_user_id ON atlas_coaches(user_id);
CREATE INDEX IF NOT EXISTS idx_atlas_coaches_stripe_account_id ON atlas_coaches(stripe_account_id) WHERE stripe_account_id IS NOT NULL;

-- services (coaching packages linked to Stripe Price)
CREATE TABLE IF NOT EXISTS atlas_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES atlas_coaches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'gbp',
  interval TEXT NOT NULL DEFAULT 'month',
  stripe_price_id TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_atlas_services_coach_id ON atlas_services(coach_id);
CREATE INDEX IF NOT EXISTS idx_atlas_services_stripe_price_id ON atlas_services(stripe_price_id) WHERE stripe_price_id IS NOT NULL;

-- leads (Stripe funnel: new -> paid -> converted)
CREATE TABLE IF NOT EXISTS atlas_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES atlas_coaches(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'paid', 'converted', 'archived')),
  source TEXT DEFAULT 'public_link',
  metadata_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_atlas_leads_coach_id ON atlas_leads(coach_id);
CREATE INDEX IF NOT EXISTS idx_atlas_leads_status ON atlas_leads(status);
CREATE INDEX IF NOT EXISTS idx_atlas_leads_created_at ON atlas_leads(created_at);

-- clients (created from lead on payment)
CREATE TABLE IF NOT EXISTS atlas_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES atlas_coaches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  metadata_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_atlas_clients_coach_id ON atlas_clients(coach_id);
CREATE INDEX IF NOT EXISTS idx_atlas_clients_created_at ON atlas_clients(created_at);

-- payments (Stripe subscriptions linked to coach, client or lead)
CREATE TABLE IF NOT EXISTS atlas_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES atlas_coaches(id) ON DELETE CASCADE,
  client_id UUID REFERENCES atlas_clients(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES atlas_leads(id) ON DELETE SET NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
  current_period_end TIMESTAMPTZ,
  last_invoice_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_atlas_payments_coach_id ON atlas_payments(coach_id);
CREATE INDEX IF NOT EXISTS idx_atlas_payments_client_id ON atlas_payments(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_atlas_payments_lead_id ON atlas_payments(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_atlas_payments_stripe_subscription_id ON atlas_payments(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- review_items (actionable queue: payment_overdue, intake_required, etc.)
CREATE TABLE IF NOT EXISTS atlas_review_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES atlas_coaches(id) ON DELETE CASCADE,
  client_id UUID REFERENCES atlas_clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'waiting', 'done')),
  priority INTEGER NOT NULL DEFAULT 0,
  dedupe_key TEXT NOT NULL,
  metadata_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(coach_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS idx_atlas_review_items_coach_id ON atlas_review_items(coach_id);
CREATE INDEX IF NOT EXISTS idx_atlas_review_items_status ON atlas_review_items(status);
CREATE INDEX IF NOT EXISTS idx_atlas_review_items_dedupe ON atlas_review_items(coach_id, dedupe_key);

-- RLS can be enabled when using Supabase Auth; Edge Functions use service_role key.
