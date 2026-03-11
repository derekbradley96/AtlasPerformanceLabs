-- Trend data for charts and client progress timelines.
-- One row per checkin; join latest compliance as of submitted_at; active_flags_count is current (snapshot).
-- Query with ORDER BY submitted_at ASC for timeline/charts.

DROP VIEW IF EXISTS public.v_client_progress_trends;

CREATE VIEW public.v_client_progress_trends
WITH (security_invoker = on)
AS
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
LEFT JOIN public.client_state cs ON cs.client_id = ch.client_id;

COMMENT ON VIEW public.v_client_progress_trends IS 'One row per checkin for trend charts and timelines. compliance = latest client_compliance as of submitted_at; active_flags_count = current. Always query with ORDER BY submitted_at ASC.';
