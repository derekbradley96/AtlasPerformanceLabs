-- Billing MVP: add billing fields to clients and v_coach_money_dashboard view.
-- No Stripe required; coach_id = COALESCE(clients.coach_id, clients.trainer_id) for ownership.

-- 1) Add columns to public.clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC,
  ADD COLUMN IF NOT EXISTS next_due_date DATE,
  ADD COLUMN IF NOT EXISTS billing_status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_billing_status_check;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_billing_status_check
  CHECK (billing_status IN ('active', 'overdue', 'paused'));

-- 2) Index for coach billing queries
CREATE INDEX IF NOT EXISTS clients_coach_billing_idx
  ON public.clients (COALESCE(coach_id, trainer_id), billing_status, next_due_date);

-- 3) View: one row per coach with aggregates
DROP VIEW IF EXISTS public.v_coach_money_dashboard;

CREATE VIEW public.v_coach_money_dashboard
WITH (security_invoker = on)
AS
SELECT
  COALESCE(c.coach_id, c.trainer_id) AS coach_id,
  count(*) FILTER (WHERE c.billing_status = 'active')::int AS active_clients_count,
  count(*) FILTER (WHERE c.billing_status = 'overdue')::int AS overdue_clients_count,
  coalesce(sum(c.monthly_fee) FILTER (WHERE c.billing_status = 'active'), 0)::numeric AS monthly_revenue_expected,
  coalesce(sum(c.monthly_fee) FILTER (WHERE c.billing_status = 'overdue'), 0)::numeric AS overdue_amount_estimate,
  count(*) FILTER (
    WHERE c.next_due_date IS NOT NULL
      AND c.next_due_date >= (current_date)
      AND c.next_due_date <= (current_date + interval '7 days')
  )::int AS next_7_days_due_count
FROM public.clients c
WHERE COALESCE(c.coach_id, c.trainer_id) IS NOT NULL
GROUP BY COALESCE(c.coach_id, c.trainer_id);

COMMENT ON VIEW public.v_coach_money_dashboard IS 'Per-coach billing summary for Money Dashboard MVP (no Stripe).';
