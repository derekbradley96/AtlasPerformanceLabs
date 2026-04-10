-- Canonical client delivery UX: transformation vs competition (not a plan tier).
-- Mirrors coach relationship + explicit classification; see resolveClientDeliveryContext in app.

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS delivery_context text;

UPDATE public.clients
SET delivery_context = CASE
  WHEN client_type = 'competition' THEN 'competition'
  WHEN client_type = 'transformation' THEN 'transformation'
  WHEN client_type = 'integrated' THEN 'transformation'
  ELSE 'transformation'
END
WHERE delivery_context IS NULL;

ALTER TABLE public.clients ALTER COLUMN delivery_context SET DEFAULT 'transformation';
ALTER TABLE public.clients ALTER COLUMN delivery_context SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_delivery_context_check'
  ) THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_delivery_context_check
      CHECK (delivery_context IN ('transformation', 'competition'));
  END IF;
END $$;

COMMENT ON COLUMN public.clients.delivery_context IS 'Client delivery experience: transformation | competition (not a tier). Integrated coaches assign per client via client_type / this column.';
