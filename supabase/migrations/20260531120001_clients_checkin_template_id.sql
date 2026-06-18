ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS checkin_template_id UUID
    REFERENCES public.checkin_templates(id)
    ON DELETE SET NULL;

COMMENT ON COLUMN public.clients.checkin_template_id IS
  'The active check-in template assigned by the coach.';
