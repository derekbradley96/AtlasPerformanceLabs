-- Platform commission view: per-payment Atlas commission and coach payout from plans.

-- =============================================================================
-- 1) V_ATLAS_COMMISSIONS
-- =============================================================================

CREATE OR REPLACE VIEW public.v_atlas_commissions
WITH (security_invoker = true)
AS
SELECT
  p.id AS payment_id,
  p.coach_id,
  p.organisation_id,
  p.amount AS payment_amount,
  COALESCE(plan.commission_percentage, 0)::numeric AS commission_percentage,
  (p.amount * COALESCE(plan.commission_percentage, 0) / 100)::numeric AS commission_amount,
  (p.amount - (p.amount * COALESCE(plan.commission_percentage, 0) / 100))::numeric AS coach_payout_amount
FROM public.client_payments p
LEFT JOIN LATERAL (
  SELECT ap.commission_percentage
  FROM public.coach_plan_subscriptions cps
  JOIN public.atlas_plans ap ON ap.id = cps.plan_id
  WHERE cps.status = 'active'
    AND (cps.coach_id = p.coach_id OR cps.organisation_id = p.organisation_id)
  ORDER BY cps.coach_id NULLS LAST
  LIMIT 1
) plan ON true;

COMMENT ON VIEW public.v_atlas_commissions IS 'Per-payment commission: resolves coach/org plan from coach_plan_subscriptions + atlas_plans, computes commission_amount and coach_payout_amount. No matching plan => 0% commission.';
