-- Stripe → client_payments bridge idempotency: one row per Stripe invoice.
-- invoice.paid and invoice.payment_succeeded both fire for the same invoice; the
-- webhook's select-before-insert alone can race, so enforce uniqueness at the DB.
create unique index if not exists client_payments_provider_payment_id_key
  on public.client_payments (provider_payment_id)
  where provider_payment_id is not null;
