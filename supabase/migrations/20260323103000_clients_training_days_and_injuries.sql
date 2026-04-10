-- Client onboarding core detail fields.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS training_days_per_week smallint,
  ADD COLUMN IF NOT EXISTS injuries text;

COMMENT ON COLUMN public.clients.training_days_per_week IS 'Preferred training days per week from client onboarding (1-7).';
COMMENT ON COLUMN public.clients.injuries IS 'Optional injuries/limitations entered during client onboarding.';
