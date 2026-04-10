-- Coach dashboard resilience hardening:
-- 1) Ensure coaching_insights table exists (prevents 404 on /coaching_insights).
-- 2) Replace v_client_retention_risk with a defensive definition based on stable tables
--    so retention widgets degrade gracefully when optional datasets are missing.

CREATE TABLE IF NOT EXISTS public.coaching_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL,
  insight_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  title text,
  description text,
  is_resolved boolean NOT NULL DEFAULT false,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coaching_insights_severity_check'
      AND conrelid = 'public.coaching_insights'::regclass
  ) THEN
    ALTER TABLE public.coaching_insights
      ADD CONSTRAINT coaching_insights_severity_check
      CHECK (severity IN ('low', 'medium', 'high'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS coaching_insights_coach_idx
  ON public.coaching_insights (coach_id, is_resolved, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS coaching_insights_client_idx
  ON public.coaching_insights (client_id, created_at DESC);

ALTER TABLE public.coaching_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coaching_insights_select_owner ON public.coaching_insights;
CREATE POLICY coaching_insights_select_owner ON public.coaching_insights
  FOR SELECT TO authenticated
  USING (
    coach_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = coaching_insights.client_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS coaching_insights_insert_coach ON public.coaching_insights;
CREATE POLICY coaching_insights_insert_coach ON public.coaching_insights
  FOR INSERT TO authenticated
  WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS coaching_insights_update_coach ON public.coaching_insights;
CREATE POLICY coaching_insights_update_coach ON public.coaching_insights
  FOR UPDATE TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS coaching_insights_delete_coach ON public.coaching_insights;
CREATE POLICY coaching_insights_delete_coach ON public.coaching_insights
  FOR DELETE TO authenticated
  USING (coach_id = auth.uid());

COMMENT ON TABLE public.coaching_insights IS
  'Coach alerts/insights shown on Coach Home. Optional dataset; missing rows should not break dashboard.';

-- Defensive retention risk view: relies on clients + checkins + billing status only.
-- This avoids runtime failures from optional/complex retention signal pipelines.
CREATE OR REPLACE VIEW public.v_client_retention_risk
WITH (security_invoker = on)
AS
WITH last_checkin AS (
  SELECT
    c.client_id,
    max(c.submitted_at) AS last_checkin_at
  FROM public.checkins c
  WHERE c.submitted_at IS NOT NULL
  GROUP BY c.client_id
)
SELECT
  cl.id AS client_id,
  COALESCE(cl.coach_id, cl.trainer_id) AS coach_id,
  COALESCE(NULLIF(trim(cl.name), ''), 'Client')::text AS client_name,
  LEAST(100, GREATEST(0,
    (
      CASE
        WHEN lc.last_checkin_at IS NULL THEN 65
        ELSE LEAST(60, GREATEST(0, ((current_date - lc.last_checkin_at::date) - 3) * 5))
      END
    ) +
    (CASE WHEN cl.billing_status = 'overdue' THEN 25 ELSE 0 END)
  ))::int AS risk_score,
  CASE
    WHEN LEAST(100, GREATEST(0,
      (
        CASE
          WHEN lc.last_checkin_at IS NULL THEN 65
          ELSE LEAST(60, GREATEST(0, ((current_date - lc.last_checkin_at::date) - 3) * 5))
        END
      ) +
      (CASE WHEN cl.billing_status = 'overdue' THEN 25 ELSE 0 END)
    )) <= 20 THEN 'healthy'
    WHEN LEAST(100, GREATEST(0,
      (
        CASE
          WHEN lc.last_checkin_at IS NULL THEN 65
          ELSE LEAST(60, GREATEST(0, ((current_date - lc.last_checkin_at::date) - 3) * 5))
        END
      ) +
      (CASE WHEN cl.billing_status = 'overdue' THEN 25 ELSE 0 END)
    )) <= 40 THEN 'watch'
    WHEN LEAST(100, GREATEST(0,
      (
        CASE
          WHEN lc.last_checkin_at IS NULL THEN 65
          ELSE LEAST(60, GREATEST(0, ((current_date - lc.last_checkin_at::date) - 3) * 5))
        END
      ) +
      (CASE WHEN cl.billing_status = 'overdue' THEN 25 ELSE 0 END)
    )) <= 60 THEN 'at_risk'
    ELSE 'churn_risk'
  END AS risk_band,
  array_remove(ARRAY[
    CASE
      WHEN lc.last_checkin_at IS NULL
        OR (current_date - lc.last_checkin_at::date) > 7
      THEN 'checkin_overdue'
    END,
    CASE WHEN cl.billing_status = 'overdue' THEN 'billing_overdue' END
  ], NULL)::text[] AS reasons
FROM public.clients cl
LEFT JOIN last_checkin lc ON lc.client_id = cl.id
WHERE COALESCE(cl.coach_id, cl.trainer_id) IS NOT NULL;

COMMENT ON VIEW public.v_client_retention_risk IS
  'Defensive retention risk view for dashboards. Uses check-in recency + billing overdue and avoids optional pipeline dependencies.';
