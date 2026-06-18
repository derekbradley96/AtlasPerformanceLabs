-- Personal progress coach upsell (peak motivation) dismissal.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coach_upsell_seen_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.coach_upsell_seen_at IS 'When set, the Progress-page "Ready to go further?" coach upsell was dismissed.';
