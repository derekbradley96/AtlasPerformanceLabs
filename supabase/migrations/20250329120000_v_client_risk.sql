-- At-risk client view: client_id, risk_score, risk_reason.
-- Built on v_client_retention_risk; one row per client for filtering and dashboards.

DROP VIEW IF EXISTS public.v_client_risk;

CREATE VIEW public.v_client_risk
WITH (security_invoker = on)
AS
SELECT
  r.client_id,
  r.risk_score,
  NULLIF(TRIM(array_to_string(COALESCE(r.reasons, ARRAY[]::text[]), ', ')), '') AS risk_reason
FROM public.v_client_retention_risk r;

COMMENT ON VIEW public.v_client_risk IS 'At-risk client summary: client_id, risk_score (0–100), risk_reason (comma-separated from triggers). Use WHERE risk_score >= 40 for at-risk. RLS via v_client_retention_risk.';
