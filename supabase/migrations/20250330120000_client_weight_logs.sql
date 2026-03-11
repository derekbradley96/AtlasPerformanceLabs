-- Bodyweight history import: client_weight_logs table and client_progress view.
-- Progress charts (v_client_progress_trends) extended to include weight_log rows.

-- 1) client_weight_logs: one row per weight entry (import or manual).
CREATE TABLE IF NOT EXISTS public.client_weight_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  weight NUMERIC,
  bodyfat NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_weight_logs_client_id ON public.client_weight_logs (client_id);
CREATE INDEX IF NOT EXISTS idx_client_weight_logs_log_date ON public.client_weight_logs (log_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_weight_logs_client_date ON public.client_weight_logs (client_id, log_date);

COMMENT ON TABLE public.client_weight_logs IS 'Imported or manual bodyweight/bodyfat history; feeds progress charts.';

ALTER TABLE public.client_weight_logs ENABLE ROW LEVEL SECURITY;

-- RLS: coach and client access via clients ownership
DROP POLICY IF EXISTS client_weight_logs_select_coach ON public.client_weight_logs;
CREATE POLICY client_weight_logs_select_coach ON public.client_weight_logs
  FOR SELECT USING (
    client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid() OR trainer_id = auth.uid())
  );
DROP POLICY IF EXISTS client_weight_logs_select_client ON public.client_weight_logs;
CREATE POLICY client_weight_logs_select_client ON public.client_weight_logs
  FOR SELECT USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );
DROP POLICY IF EXISTS client_weight_logs_insert_coach ON public.client_weight_logs;
CREATE POLICY client_weight_logs_insert_coach ON public.client_weight_logs
  FOR INSERT WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid() OR trainer_id = auth.uid())
  );
DROP POLICY IF EXISTS client_weight_logs_insert_client ON public.client_weight_logs;
CREATE POLICY client_weight_logs_insert_client ON public.client_weight_logs
  FOR INSERT WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

-- 2) client_progress: view over weight logs for progress display (and any future progress fields).
DROP VIEW IF EXISTS public.client_progress;
CREATE VIEW public.client_progress
WITH (security_invoker = on)
AS
SELECT
  client_id,
  log_date AS progress_date,
  weight,
  bodyfat,
  notes,
  created_at
FROM public.client_weight_logs;

COMMENT ON VIEW public.client_progress IS 'Progress snapshot view over client_weight_logs; use for charts and reports.';

-- 3) Extend v_client_progress_trends to include weight_log rows so charts show imported bodyweight history.
DROP VIEW IF EXISTS public.v_client_progress_trends;

CREATE VIEW public.v_client_progress_trends
WITH (security_invoker = on)
AS
-- Rows from checkins (full trend fields)
SELECT
  ch.client_id,
  ch.id AS checkin_id,
  ch.submitted_at,
  ch.week_start,
  ch.weight,
  (
    (COALESCE(comp.training_adherence_pct, 0) + COALESCE(comp.nutrition_adherence_pct, 0))
    / NULLIF(
      (CASE WHEN comp.training_adherence_pct IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN comp.nutrition_adherence_pct IS NOT NULL THEN 1 ELSE 0 END),
      0
    )
  )::numeric AS compliance,
  ch.sleep_score,
  ch.energy_level,
  ch.steps_avg,
  ch.training_completion,
  ch.nutrition_adherence,
  ch.cardio_completion,
  COALESCE(cs.active_flags_count, 0)::int AS active_flags_count
FROM public.checkins ch
LEFT JOIN LATERAL (
  SELECT training_adherence_pct, nutrition_adherence_pct
  FROM public.client_compliance
  WHERE client_id = ch.client_id
    AND recorded_at <= ch.submitted_at
  ORDER BY recorded_at DESC
  LIMIT 1
) comp ON true
LEFT JOIN public.client_state cs ON cs.client_id = ch.client_id

UNION ALL

-- Rows from client_weight_logs (weight-only; no checkin) so imported history appears on charts
SELECT
  wl.client_id,
  NULL::uuid AS checkin_id,
  (wl.log_date::timestamp AT TIME ZONE 'UTC')::timestamptz AS submitted_at,
  wl.log_date AS week_start,
  wl.weight,
  NULL::numeric AS compliance,
  NULL::integer AS sleep_score,
  NULL::integer AS energy_level,
  NULL::integer AS steps_avg,
  NULL::integer AS training_completion,
  NULL::integer AS nutrition_adherence,
  NULL::integer AS cardio_completion,
  COALESCE(cs2.active_flags_count, 0)::int AS active_flags_count
FROM public.client_weight_logs wl
LEFT JOIN public.client_state cs2 ON cs2.client_id = wl.client_id
WHERE wl.weight IS NOT NULL;

COMMENT ON VIEW public.v_client_progress_trends IS 'One row per checkin plus one per client_weight_log entry for trend charts. Query with ORDER BY submitted_at ASC.';
