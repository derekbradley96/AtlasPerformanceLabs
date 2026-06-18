-- Coach-assigned client journey pathway stage (integrated / long-term coaching UX).
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS journey_stage TEXT;

COMMENT ON COLUMN public.clients.journey_stage IS 'Pathway stage id: foundation | development | transformation | competition_curious | first_prep | experienced_competitor';
