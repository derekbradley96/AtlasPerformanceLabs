-- Support different coaching models per client: online | in_person | hybrid.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS membership_type TEXT;

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_membership_type_check;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_membership_type_check
  CHECK (membership_type IS NULL OR membership_type IN ('online', 'in_person', 'hybrid'));

CREATE INDEX IF NOT EXISTS idx_clients_membership_type
  ON public.clients (membership_type)
  WHERE membership_type IS NOT NULL;

COMMENT ON COLUMN public.clients.membership_type IS 'Coaching model: online | in_person | hybrid. NULL = unset/legacy.';
