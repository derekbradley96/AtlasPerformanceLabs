-- Coach subscription tiers for Atlas commission: Basic 10%, Pro 3%, Elite 0%.
-- Used during Stripe webhook processing to calculate platform fee.

CREATE TABLE IF NOT EXISTS public.coach_subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('basic', 'pro', 'elite')),
  commission_rate NUMERIC(5, 4) NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_coach_subscription_tiers_coach
  ON public.coach_subscription_tiers(coach_id);

COMMENT ON TABLE public.coach_subscription_tiers IS 'Coach subscription tier and Atlas commission rate. Basic 10%, Pro 3%, Elite 0%.';

-- Default commission by tier (for reference; app uses row commission_rate)
-- basic -> 0.10, pro -> 0.03, elite -> 0.00

ALTER TABLE public.coach_subscription_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_subscription_tiers_select_own ON public.coach_subscription_tiers;
DROP POLICY IF EXISTS coach_subscription_tiers_insert_own ON public.coach_subscription_tiers;
DROP POLICY IF EXISTS coach_subscription_tiers_update_own ON public.coach_subscription_tiers;
DROP POLICY IF EXISTS coach_subscription_tiers_delete_own ON public.coach_subscription_tiers;

CREATE POLICY coach_subscription_tiers_select_own ON public.coach_subscription_tiers
  FOR SELECT USING (coach_id = auth.uid());
CREATE POLICY coach_subscription_tiers_insert_own ON public.coach_subscription_tiers
  FOR INSERT WITH CHECK (coach_id = auth.uid());
CREATE POLICY coach_subscription_tiers_update_own ON public.coach_subscription_tiers
  FOR UPDATE USING (coach_id = auth.uid());
CREATE POLICY coach_subscription_tiers_delete_own ON public.coach_subscription_tiers
  FOR DELETE USING (coach_id = auth.uid());

-- Service role / backend can read all for webhook fee calculation (no policy = deny; use service role key to bypass RLS or add a policy for service)
-- For webhook processing the backend typically uses service_role and reads by coach_id.
