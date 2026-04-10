-- Webhook-backed coach billing state + silent-upgrade tracking.

CREATE TABLE IF NOT EXISTS public.coach_billing_state (
  coach_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan_tier TEXT NOT NULL DEFAULT 'basic' CHECK (plan_tier IN ('basic', 'pro', 'elite')),
  subscription_status TEXT NOT NULL DEFAULT 'inactive',
  current_period_end TIMESTAMPTZ,
  monthly_revenue_estimate NUMERIC(12, 2) NOT NULL DEFAULT 0,
  monthly_fees_estimate NUMERIC(12, 2) NOT NULL DEFAULT 0,
  recommended_plan TEXT NOT NULL DEFAULT 'basic' CHECK (recommended_plan IN ('basic', 'pro', 'elite')),
  last_upgrade_prompt_at TIMESTAMPTZ,
  upgrade_prompt_cooldown_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coach_billing_state_plan_idx ON public.coach_billing_state(plan_tier);
CREATE INDEX IF NOT EXISTS coach_billing_state_recommended_idx ON public.coach_billing_state(recommended_plan);

COMMENT ON TABLE public.coach_billing_state IS 'Stripe webhook-backed billing summary and upgrade recommendation state for each coach.';

ALTER TABLE public.coach_billing_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_billing_state_select_own ON public.coach_billing_state;
CREATE POLICY coach_billing_state_select_own ON public.coach_billing_state
  FOR SELECT USING (coach_id = auth.uid());

DROP POLICY IF EXISTS coach_billing_state_update_own ON public.coach_billing_state;
CREATE POLICY coach_billing_state_update_own ON public.coach_billing_state
  FOR UPDATE USING (coach_id = auth.uid());

-- INSERT/DELETE intentionally service role only (edge functions).

CREATE TABLE IF NOT EXISTS public.upgrade_trigger_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL,
  context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  shown_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS upgrade_trigger_events_coach_idx ON public.upgrade_trigger_events(coach_id, created_at DESC);
CREATE INDEX IF NOT EXISTS upgrade_trigger_events_trigger_idx ON public.upgrade_trigger_events(trigger_type, created_at DESC);

COMMENT ON TABLE public.upgrade_trigger_events IS 'Silent upgrade trigger telemetry (shown/clicked/converted) for conversion analysis.';

ALTER TABLE public.upgrade_trigger_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS upgrade_trigger_events_select_own ON public.upgrade_trigger_events;
CREATE POLICY upgrade_trigger_events_select_own ON public.upgrade_trigger_events
  FOR SELECT USING (coach_id = auth.uid());

-- INSERT/UPDATE/DELETE intentionally service role only.
