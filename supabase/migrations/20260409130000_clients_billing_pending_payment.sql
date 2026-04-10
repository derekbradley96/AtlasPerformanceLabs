-- Allow coach-offer checkout gating: client must complete Stripe (or free/deferred offer) before full app access.
ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_billing_status_check;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_billing_status_check
  CHECK (billing_status IN ('active', 'overdue', 'paused', 'pending_payment'));

COMMENT ON COLUMN public.clients.billing_status IS
  'active = full access; overdue/paused = billing ops; pending_payment = joined coach, online payment for selected atlas_services package not yet completed.';
