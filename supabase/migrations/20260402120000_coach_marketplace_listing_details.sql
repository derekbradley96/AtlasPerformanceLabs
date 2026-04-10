-- Structured marketplace listing fields (services, positioning, trust) as JSONB for coach_marketplace_profiles.
-- App reads/writes listing_details; legacy rows default to {}.

ALTER TABLE public.coach_marketplace_profiles
  ADD COLUMN IF NOT EXISTS listing_details JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.coach_marketplace_profiles.listing_details IS
  'Structured listing: delivery_mode, ideal_client_lines, not_ideal_lines, services toggles, trust metrics, consultation flags, etc.';
