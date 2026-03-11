-- Retention risk score and band per client.
-- View: public.v_client_retention_risk
-- Built on: public.v_client_retention_signals
-- Scoring: additive points from triggers; bands healthy / watch / at_risk / churn_risk.
-- Replaces previous v_client_retention_risk definition with new rules.

DROP VIEW IF EXISTS public.v_client_retention_risk;

CREATE VIEW public.v_client_retention_risk
WITH (security_invoker = on)
AS
WITH scored AS (
  SELECT
    s.client_id,
    s.coach_id,
    COALESCE(c.name, '')::text AS client_name,
    LEAST(100, (
      0
      + CASE WHEN s.days_since_last_checkin IS NOT NULL AND s.days_since_last_checkin > 10 THEN 20 ELSE 0 END
      + CASE WHEN COALESCE(s.workouts_last_7d, 0) = 0 THEN 15 ELSE 0 END
      + CASE WHEN s.compliance_last_4w IS NOT NULL AND s.compliance_last_4w < 60 THEN 15 ELSE 0 END
      + CASE WHEN s.days_since_last_message IS NOT NULL AND s.days_since_last_message > 14 THEN 10 ELSE 0 END
      + CASE WHEN COALESCE(s.active_flags_count, 0) > 0 THEN 10 ELSE 0 END
      + CASE WHEN s.billing_status = 'overdue' THEN 15 ELSE 0 END
    ))::int AS risk_score,
    array_remove(ARRAY[
      CASE WHEN s.days_since_last_checkin IS NOT NULL AND s.days_since_last_checkin > 10 THEN 'days_since_last_checkin_high' END,
      CASE WHEN COALESCE(s.workouts_last_7d, 0) = 0 THEN 'no_workouts_last_7d' END,
      CASE WHEN s.compliance_last_4w IS NOT NULL AND s.compliance_last_4w < 60 THEN 'compliance_last_4w_low' END,
      CASE WHEN s.days_since_last_message IS NOT NULL AND s.days_since_last_message > 14 THEN 'days_since_last_message_high' END,
      CASE WHEN COALESCE(s.active_flags_count, 0) > 0 THEN 'active_flags_present' END,
      CASE WHEN s.billing_status = 'overdue' THEN 'billing_overdue' END
    ], NULL) AS reasons
  FROM public.v_client_retention_signals s
  JOIN public.clients c ON c.id = s.client_id
)
SELECT
  client_id,
  coach_id,
  client_name,
  risk_score,
  CASE
    WHEN risk_score <= 20 THEN 'healthy'
    WHEN risk_score <= 40 THEN 'watch'
    WHEN risk_score <= 60 THEN 'at_risk'
    ELSE 'churn_risk'
  END AS risk_band,
  reasons
FROM scored;

COMMENT ON VIEW public.v_client_retention_risk IS 'Retention risk per client: risk_score 0–100, risk_band (healthy|watch|at_risk|churn_risk), reasons[] from triggers. Includes client_name for UI. Built on v_client_retention_signals. Query: WHERE coach_id = auth.uid() ORDER BY risk_score DESC.';
