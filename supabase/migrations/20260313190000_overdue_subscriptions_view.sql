-- Overdue subscription alerts: subscriptions whose next_billing_date is in the past.

-- =============================================================================
-- 1) V_OVERDUE_SUBSCRIPTIONS
-- =============================================================================

CREATE OR REPLACE VIEW public.v_overdue_subscriptions
WITH (security_invoker = true)
AS
SELECT
  s.client_id,
  s.coach_id,
  s.id AS subscription_id,
  s.next_billing_date,
  (current_date - s.next_billing_date)::int AS days_overdue,
  s.price,
  COALESCE(c.name, '')::text AS client_name
FROM public.client_subscriptions s
JOIN public.clients c ON c.id = s.client_id
WHERE s.next_billing_date IS NOT NULL
  AND s.next_billing_date < current_date
  AND s.coach_id IS NOT NULL
  AND (s.status IS NULL OR s.status IN ('active', 'overdue'));

COMMENT ON VIEW public.v_overdue_subscriptions IS 'Subscriptions with next_billing_date in the past; for coach overdue payment alerts.';
