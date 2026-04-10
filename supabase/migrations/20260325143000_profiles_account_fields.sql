-- Role-aware account fields stored on profiles for full server-backed persistence.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS goal TEXT,
  ADD COLUMN IF NOT EXISTS training_focus TEXT,
  ADD COLUMN IF NOT EXISTS current_weight NUMERIC,
  ADD COLUMN IF NOT EXISTS target_weight NUMERIC,
  ADD COLUMN IF NOT EXISTS units TEXT,
  ADD COLUMN IF NOT EXISTS business_name TEXT;

COMMENT ON COLUMN public.profiles.goal IS 'Primary user goal (personal/client/coached context).';
COMMENT ON COLUMN public.profiles.training_focus IS 'Training focus (e.g. strength, hypertrophy, endurance).';
COMMENT ON COLUMN public.profiles.current_weight IS 'Current bodyweight for planning/progress context.';
COMMENT ON COLUMN public.profiles.target_weight IS 'Target bodyweight for planning/progress context.';
COMMENT ON COLUMN public.profiles.units IS 'Preferred unit system for weight display (kg/lb).';
COMMENT ON COLUMN public.profiles.business_name IS 'Coach business/brand name.';
