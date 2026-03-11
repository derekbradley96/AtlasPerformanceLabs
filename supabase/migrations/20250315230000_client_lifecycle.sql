-- Client lifecycle: stored stage on clients + helper view with risk-based fallback.
-- Column: clients.lifecycle_stage (lead, onboarding, active, engaged, watch, at_risk, churn_risk, former).
-- View: v_client_lifecycle exposes lifecycle_stage and effective_stage (stored or derived from risk_band).

-- 1) Add column to public.clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT;

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_lifecycle_stage_check;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_lifecycle_stage_check
  CHECK (lifecycle_stage IS NULL OR lifecycle_stage IN (
    'lead', 'onboarding', 'active', 'engaged', 'watch', 'at_risk', 'churn_risk', 'former'
  ));

CREATE INDEX IF NOT EXISTS idx_clients_lifecycle_stage
  ON public.clients (lifecycle_stage) WHERE lifecycle_stage IS NOT NULL;

COMMENT ON COLUMN public.clients.lifecycle_stage IS 'Coach-set lifecycle stage. When NULL, v_client_lifecycle derives from retention risk_band.';

-- 2) Helper view: effective stage = stored lifecycle_stage or risk-based (churn_risk / at_risk / watch / engaged)
DROP VIEW IF EXISTS public.v_client_lifecycle;

CREATE VIEW public.v_client_lifecycle
WITH (security_invoker = on)
AS
SELECT
  c.id AS client_id,
  COALESCE(c.coach_id, c.trainer_id) AS coach_id,
  c.lifecycle_stage,
  COALESCE(
    c.lifecycle_stage,
    CASE r.risk_band
      WHEN 'churn_risk' THEN 'churn_risk'
      WHEN 'at_risk' THEN 'at_risk'
      WHEN 'watch' THEN 'watch'
      ELSE 'engaged'
    END
  )::text AS effective_stage
FROM public.clients c
LEFT JOIN public.v_client_retention_risk r ON r.client_id = c.id;

COMMENT ON VIEW public.v_client_lifecycle IS 'Per-client lifecycle: lifecycle_stage (stored) and effective_stage (stored or derived from risk_band: churn_risk→churn_risk, at_risk→at_risk, watch→watch, else engaged). Query: WHERE coach_id = auth.uid().';
