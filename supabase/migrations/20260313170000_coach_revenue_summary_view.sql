-- Revenue analytics view for coach dashboards: totals, last 30/90 days, active clients, average value.

-- =============================================================================
-- 1) V_COACH_REVENUE_SUMMARY
-- =============================================================================

CREATE OR REPLACE VIEW public.v_coach_revenue_summary
WITH (security_invoker = true)
AS
WITH payment_agg AS (
  SELECT
    coach_id,
    SUM(amount) FILTER (
      WHERE status = 'paid'
    ) AS total_revenue,
    SUM(amount) FILTER (
      WHERE status = 'paid'
        AND COALESCE(paid_at, created_at) >= (current_timestamp - interval '30 days')
    ) AS revenue_last_30d,
    SUM(amount) FILTER (
      WHERE status = 'paid'
        AND COALESCE(paid_at, created_at) >= (current_timestamp - interval '90 days')
    ) AS revenue_last_90d
  FROM public.client_payments
  WHERE coach_id IS NOT NULL
  GROUP BY coach_id
),
active_clients_agg AS (
  SELECT
    coach_id,
    COUNT(DISTINCT client_id)::int AS active_clients
  FROM public.client_subscriptions
  WHERE coach_id IS NOT NULL
    AND status = 'active'
  GROUP BY coach_id
),
coach_ids AS (
  SELECT DISTINCT coach_id FROM public.client_payments WHERE coach_id IS NOT NULL
  UNION
  SELECT DISTINCT coach_id FROM public.client_subscriptions WHERE coach_id IS NOT NULL
)
SELECT
  c.coach_id,
  COALESCE(p.total_revenue, 0)::numeric AS total_revenue,
  COALESCE(p.revenue_last_30d, 0)::numeric AS revenue_last_30d,
  COALESCE(p.revenue_last_90d, 0)::numeric AS revenue_last_90d,
  COALESCE(a.active_clients, 0)::int AS active_clients,
  CASE
    WHEN COALESCE(a.active_clients, 0) > 0
    THEN (COALESCE(p.total_revenue, 0) / a.active_clients)::numeric
    ELSE NULL
  END AS average_client_value
FROM coach_ids c
LEFT JOIN payment_agg p ON p.coach_id = c.coach_id
LEFT JOIN active_clients_agg a ON a.coach_id = c.coach_id;

COMMENT ON VIEW public.v_coach_revenue_summary IS 'Per-coach revenue summary: total revenue, last 30/90 days, active subscription count, average revenue per active client. Uses client_payments (status=paid) and client_subscriptions (status=active).';
