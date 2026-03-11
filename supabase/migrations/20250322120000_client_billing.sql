-- Client billing status (Stripe subscription tracking).
-- Ownership: coach via clients.coach_id; client read-only via clients.user_id.

CREATE TABLE IF NOT EXISTS public.client_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan_name TEXT,
  billing_status TEXT,
  next_payment_date DATE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_billing_client
  ON public.client_billing(client_id);
CREATE INDEX IF NOT EXISTS idx_client_billing_stripe_customer
  ON public.client_billing(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_billing_stripe_subscription
  ON public.client_billing(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

COMMENT ON TABLE public.client_billing IS 'Client billing status: Stripe customer/subscription, plan, next payment.';

ALTER TABLE public.client_billing ENABLE ROW LEVEL SECURITY;

-- Coach: full access for their clients
DROP POLICY IF EXISTS client_billing_select_coach ON public.client_billing;
DROP POLICY IF EXISTS client_billing_insert_coach ON public.client_billing;
DROP POLICY IF EXISTS client_billing_update_coach ON public.client_billing;
DROP POLICY IF EXISTS client_billing_delete_coach ON public.client_billing;

CREATE POLICY client_billing_select_coach ON public.client_billing FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_billing.client_id AND c.coach_id = auth.uid())
);
CREATE POLICY client_billing_insert_coach ON public.client_billing FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_billing.client_id AND c.coach_id = auth.uid())
);
CREATE POLICY client_billing_update_coach ON public.client_billing FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_billing.client_id AND c.coach_id = auth.uid())
);
CREATE POLICY client_billing_delete_coach ON public.client_billing FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_billing.client_id AND c.coach_id = auth.uid())
);

-- Client: read-only for own row
DROP POLICY IF EXISTS client_billing_select_client ON public.client_billing;

CREATE POLICY client_billing_select_client ON public.client_billing FOR SELECT USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);
