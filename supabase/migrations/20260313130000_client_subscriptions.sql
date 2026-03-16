-- Core billing: client subscriptions table for tracking subscriptions and payments.
-- Complements client_billing / clients billing fields; allows multiple subscription records per client over time.

-- =============================================================================
-- 1) CLIENT_SUBSCRIPTIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.client_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  organisation_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL,
  plan_name TEXT,
  price NUMERIC,
  currency TEXT NOT NULL DEFAULT 'GBP',
  billing_interval TEXT,
  status TEXT,
  start_date DATE,
  next_billing_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_subscriptions
  DROP CONSTRAINT IF EXISTS client_subscriptions_status_check;

ALTER TABLE public.client_subscriptions
  ADD CONSTRAINT client_subscriptions_status_check
  CHECK (status IS NULL OR status IN ('active', 'paused', 'cancelled', 'overdue'));

CREATE INDEX IF NOT EXISTS client_subscriptions_client_idx
  ON public.client_subscriptions(client_id);

CREATE INDEX IF NOT EXISTS client_subscriptions_coach_idx
  ON public.client_subscriptions(coach_id)
  WHERE coach_id IS NOT NULL;

COMMENT ON TABLE public.client_subscriptions IS 'Client subscription records: plan, price, interval, status. Used for billing and payment tracking.';
COMMENT ON COLUMN public.client_subscriptions.status IS 'active | paused | cancelled | overdue';

ALTER TABLE public.client_subscriptions ENABLE ROW LEVEL SECURITY;

-- Coach: full access for their clients (match client_billing pattern)
DROP POLICY IF EXISTS client_subscriptions_select_coach ON public.client_subscriptions;
DROP POLICY IF EXISTS client_subscriptions_insert_coach ON public.client_subscriptions;
DROP POLICY IF EXISTS client_subscriptions_update_coach ON public.client_subscriptions;
DROP POLICY IF EXISTS client_subscriptions_delete_coach ON public.client_subscriptions;

CREATE POLICY client_subscriptions_select_coach ON public.client_subscriptions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_subscriptions.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid()))
  );
CREATE POLICY client_subscriptions_insert_coach ON public.client_subscriptions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_subscriptions.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid()))
  );
CREATE POLICY client_subscriptions_update_coach ON public.client_subscriptions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_subscriptions.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid()))
  );
CREATE POLICY client_subscriptions_delete_coach ON public.client_subscriptions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_subscriptions.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid()))
  );

-- Client: read-only for own subscriptions
DROP POLICY IF EXISTS client_subscriptions_select_client ON public.client_subscriptions;

CREATE POLICY client_subscriptions_select_client ON public.client_subscriptions
  FOR SELECT USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

-- =============================================================================
-- Schema summary
-- =============================================================================
-- public.client_subscriptions:
--   id                  uuid PK default gen_random_uuid()
--   client_id           uuid not null references public.clients(id) on delete cascade
--   coach_id            uuid references public.profiles(id) on delete set null
--   organisation_id     uuid references public.organisations(id) on delete set null
--   plan_name           text
--   price               numeric
--   currency            text not null default 'GBP'
--   billing_interval    text
--   status              text check (active | paused | cancelled | overdue)
--   start_date          date
--   next_billing_date    date
--   created_at          timestamptz not null default now()
--   Indexes: client_subscriptions_client_idx (client_id), client_subscriptions_coach_idx (coach_id) where coach_id is not null
