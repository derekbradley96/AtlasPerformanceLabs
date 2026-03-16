-- Atlas SaaS plan definitions: name, monthly price, commission. Used to determine commission model.

-- =============================================================================
-- 1) ATLAS_PLANS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.atlas_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  monthly_price NUMERIC NOT NULL DEFAULT 0,
  commission_percentage NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS atlas_plans_name_key
  ON public.atlas_plans(name);

COMMENT ON TABLE public.atlas_plans IS 'Atlas platform plans (Basic/Pro/Elite): monthly price and commission percentage.';
COMMENT ON COLUMN public.atlas_plans.commission_percentage IS 'Platform commission as percentage (e.g. 10 for 10%).';

ALTER TABLE public.atlas_plans ENABLE ROW LEVEL SECURITY;

-- Allow read for authenticated users (app needs to show plan options and apply commission logic)
CREATE POLICY atlas_plans_select_authenticated ON public.atlas_plans
  FOR SELECT TO authenticated
  USING (true);

-- Only service role can insert/update/delete (platform config)
-- No INSERT/UPDATE/DELETE policies => only service role can modify

-- =============================================================================
-- 2) SEED ROWS
-- =============================================================================

INSERT INTO public.atlas_plans (name, monthly_price, commission_percentage)
VALUES
  ('Basic', 0, 10),
  ('Pro', 59, 3),
  ('Elite', 79, 0)
ON CONFLICT (name) DO NOTHING;
