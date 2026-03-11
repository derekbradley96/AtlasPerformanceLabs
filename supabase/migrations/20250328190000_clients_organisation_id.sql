-- Assign clients to an organisation (optional).
-- Clients can belong to one organisation; used for team/studio scoping.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_organisation_id
  ON public.clients(organisation_id)
  WHERE organisation_id IS NOT NULL;

COMMENT ON COLUMN public.clients.organisation_id IS 'Optional: organisation this client belongs to (for team/studio scoping).';
