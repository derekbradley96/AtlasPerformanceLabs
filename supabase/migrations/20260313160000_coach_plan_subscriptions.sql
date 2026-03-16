-- Coach plan assignment: link coaches (or organisations) to Atlas platform plans (Basic/Pro/Elite).

-- =============================================================================
-- 1) COACH_PLAN_SUBSCRIPTIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.coach_plan_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  organisation_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL,
  plan_id UUID NOT NULL REFERENCES public.atlas_plans(id) ON DELETE RESTRICT,
  status TEXT,
  started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_plan_subscriptions
  DROP CONSTRAINT IF EXISTS coach_plan_subscriptions_status_check;

ALTER TABLE public.coach_plan_subscriptions
  ADD CONSTRAINT coach_plan_subscriptions_status_check
  CHECK (status IS NULL OR status IN ('active', 'cancelled'));

CREATE INDEX IF NOT EXISTS coach_plan_subscriptions_coach_idx
  ON public.coach_plan_subscriptions(coach_id)
  WHERE coach_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS coach_plan_subscriptions_organisation_idx
  ON public.coach_plan_subscriptions(organisation_id)
  WHERE organisation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS coach_plan_subscriptions_plan_idx
  ON public.coach_plan_subscriptions(plan_id);

COMMENT ON TABLE public.coach_plan_subscriptions IS 'Coach (or organisation) assignment to an Atlas platform plan; status active | cancelled.';
COMMENT ON COLUMN public.coach_plan_subscriptions.status IS 'active | cancelled';

ALTER TABLE public.coach_plan_subscriptions ENABLE ROW LEVEL SECURITY;

-- Coach: read/update own row(s)
DROP POLICY IF EXISTS coach_plan_subscriptions_select_coach ON public.coach_plan_subscriptions;
DROP POLICY IF EXISTS coach_plan_subscriptions_update_coach ON public.coach_plan_subscriptions;

CREATE POLICY coach_plan_subscriptions_select_coach ON public.coach_plan_subscriptions
  FOR SELECT USING (
    coach_id = auth.uid()
    OR organisation_id IN (SELECT organisation_id FROM public.organisation_members WHERE profile_id = auth.uid())
  );
CREATE POLICY coach_plan_subscriptions_update_coach ON public.coach_plan_subscriptions
  FOR UPDATE USING (
    coach_id = auth.uid()
    OR organisation_id IN (SELECT organisation_id FROM public.organisation_members WHERE profile_id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- Insert/delete: service role or admin only (plan changes are typically via Stripe/webhook or admin)
-- No INSERT/DELETE policies for authenticated => only service role can create/delete
