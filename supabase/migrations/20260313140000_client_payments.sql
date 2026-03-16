-- Track every payment made by clients (linked to subscriptions where applicable).

-- =============================================================================
-- 1) CLIENT_PAYMENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.client_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.client_subscriptions(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  coach_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  organisation_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL,
  amount NUMERIC,
  currency TEXT NOT NULL DEFAULT 'GBP',
  status TEXT,
  payment_provider TEXT,
  provider_payment_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_payments
  DROP CONSTRAINT IF EXISTS client_payments_status_check;

ALTER TABLE public.client_payments
  ADD CONSTRAINT client_payments_status_check
  CHECK (status IS NULL OR status IN ('paid', 'pending', 'failed', 'refunded'));

CREATE INDEX IF NOT EXISTS client_payments_client_idx
  ON public.client_payments(client_id)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS client_payments_coach_idx
  ON public.client_payments(coach_id)
  WHERE coach_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS client_payments_created_idx
  ON public.client_payments(created_at DESC);

COMMENT ON TABLE public.client_payments IS 'Individual payments by clients; links to subscription and provider id for reconciliation.';
COMMENT ON COLUMN public.client_payments.status IS 'paid | pending | failed | refunded';

ALTER TABLE public.client_payments ENABLE ROW LEVEL SECURITY;

-- Coach: full access for their clients
DROP POLICY IF EXISTS client_payments_select_coach ON public.client_payments;
DROP POLICY IF EXISTS client_payments_insert_coach ON public.client_payments;
DROP POLICY IF EXISTS client_payments_update_coach ON public.client_payments;
DROP POLICY IF EXISTS client_payments_delete_coach ON public.client_payments;

CREATE POLICY client_payments_select_coach ON public.client_payments
  FOR SELECT USING (
    coach_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_payments.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid()))
  );
CREATE POLICY client_payments_insert_coach ON public.client_payments
  FOR INSERT WITH CHECK (
    coach_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_payments.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid()))
  );
CREATE POLICY client_payments_update_coach ON public.client_payments
  FOR UPDATE USING (
    coach_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_payments.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid()))
  );
CREATE POLICY client_payments_delete_coach ON public.client_payments
  FOR DELETE USING (
    coach_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_payments.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid()))
  );

-- Client: read-only for own payments
DROP POLICY IF EXISTS client_payments_select_client ON public.client_payments;

CREATE POLICY client_payments_select_client ON public.client_payments
  FOR SELECT USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

-- =============================================================================
-- Schema summary
-- =============================================================================
-- public.client_payments:
--   id                  uuid PK default gen_random_uuid()
--   subscription_id     uuid references public.client_subscriptions(id) on delete set null
--   client_id           uuid references public.clients(id) on delete set null
--   coach_id            uuid references public.profiles(id) on delete set null
--   organisation_id     uuid references public.organisations(id) on delete set null
--   amount              numeric
--   currency            text not null default 'GBP'
--   status              text check (paid | pending | failed | refunded)
--   payment_provider    text
--   provider_payment_id text
--   paid_at             timestamptz
--   created_at          timestamptz not null default now()
--   Indexes: client_payments_client_idx, client_payments_coach_idx, client_payments_created_idx
