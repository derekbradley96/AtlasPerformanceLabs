-- Client onboarding: persist chosen coaching package (atlas_services) on public.clients.
-- Nullable FK; ON DELETE SET NULL if coach removes a service.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS selected_service_id UUID REFERENCES public.atlas_services(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS clients_selected_service_id_idx
  ON public.clients(selected_service_id)
  WHERE selected_service_id IS NOT NULL;

COMMENT ON COLUMN public.clients.selected_service_id IS
  'Coaching package selected during client join (references public.atlas_services.id).';
