-- Retention signals data layer: one row per client for engagement and churn risk patterns.
-- View: public.v_client_retention_signals
-- Sources: checkins, workout_sessions, message_threads/message_messages, client_compliance,
--          client_flags, clients, contest_preps, client_state.
-- Missing or unsafe data returns NULL for that column.

DROP VIEW IF EXISTS public.v_client_retention_signals;

CREATE VIEW public.v_client_retention_signals
WITH (security_invoker = on)
AS
WITH
  -- Last checkin per client (submitted_at)
  last_checkin AS (
    SELECT
      client_id,
      max(submitted_at) AS last_at
    FROM public.checkins
    WHERE submitted_at IS NOT NULL
    GROUP BY client_id
  ),
  -- Last workout per client: latest of completed_at or started_at (client_id only)
  last_workout AS (
    SELECT
      client_id,
      max(COALESCE(completed_at, started_at)) AS last_at
    FROM public.workout_sessions
    WHERE client_id IS NOT NULL
      AND (completed_at IS NOT NULL OR started_at IS NOT NULL)
    GROUP BY client_id
  ),
  -- Last message per client (any message in thread for that client)
  last_message AS (
    SELECT
      mt.client_id,
      max(mm.created_at) AS last_at
    FROM public.message_threads mt
    JOIN public.message_messages mm ON mm.thread_id = mt.id
    WHERE mt.deleted_at IS NULL
    GROUP BY mt.client_id
  ),
  -- Compliance last 4 weeks: average of (training + nutrition) / 2 when both present
  compliance_last_4w AS (
    SELECT
      client_id,
      avg(
        (COALESCE(training_adherence_pct, 0) + COALESCE(nutrition_adherence_pct, 0))
        / NULLIF(
          (CASE WHEN training_adherence_pct IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN nutrition_adherence_pct IS NOT NULL THEN 1 ELSE 0 END),
          0
        )
      )::numeric AS compliance_pct
    FROM public.client_compliance
    WHERE recorded_at >= (now() - interval '4 weeks')
    GROUP BY client_id
  ),
  -- Workout counts: completed sessions in window (client_id only)
  workouts_7d AS (
    SELECT
      client_id,
      count(*)::int AS cnt
    FROM public.workout_sessions
    WHERE client_id IS NOT NULL
      AND status = 'completed'
      AND completed_at >= (now() - interval '7 days')
    GROUP BY client_id
  ),
  workouts_14d AS (
    SELECT
      client_id,
      count(*)::int AS cnt
    FROM public.workout_sessions
    WHERE client_id IS NOT NULL
      AND status = 'completed'
      AND completed_at >= (now() - interval '14 days')
    GROUP BY client_id
  ),
  checkins_30d AS (
    SELECT
      client_id,
      count(*)::int AS cnt
    FROM public.checkins
    WHERE submitted_at >= (now() - interval '30 days')
    GROUP BY client_id
  ),
  -- Active flags count (unresolved)
  active_flags AS (
    SELECT
      client_id,
      count(*)::int AS cnt
    FROM public.client_flags
    WHERE resolved_at IS NULL
    GROUP BY client_id
  ),
  -- Active prep: one row per client with is_active = true
  active_prep AS (
    SELECT
      client_id,
      (show_date - current_date)::int AS days_out
    FROM public.contest_preps
    WHERE is_active = true
  )
SELECT
  c.id AS client_id,
  COALESCE(c.coach_id, c.trainer_id) AS coach_id,
  (current_date - (lc.last_at::date))::int AS days_since_last_checkin,
  (current_date - (lw.last_at::date))::int AS days_since_last_workout,
  (current_date - (lm.last_at::date))::int AS days_since_last_message,
  comp.compliance_pct AS compliance_last_4w,
  COALESCE(w7.cnt, 0)::int AS workouts_last_7d,
  COALESCE(w14.cnt, 0)::int AS workouts_last_14d,
  COALESCE(ch30.cnt, 0)::int AS checkins_last_30d,
  COALESCE(af.cnt, 0)::int AS active_flags_count,
  c.billing_status,
  (ap.client_id IS NOT NULL) AS prep_active,
  ap.days_out AS days_out
FROM public.clients c
LEFT JOIN last_checkin lc ON lc.client_id = c.id
LEFT JOIN last_workout lw ON lw.client_id = c.id
LEFT JOIN last_message lm ON lm.client_id = c.id
LEFT JOIN compliance_last_4w comp ON comp.client_id = c.id
LEFT JOIN workouts_7d w7 ON w7.client_id = c.id
LEFT JOIN workouts_14d w14 ON w14.client_id = c.id
LEFT JOIN checkins_30d ch30 ON ch30.client_id = c.id
LEFT JOIN active_flags af ON af.client_id = c.id
LEFT JOIN active_prep ap ON ap.client_id = c.id;

COMMENT ON VIEW public.v_client_retention_signals IS 'Retention signals per client: engagement recency, compliance, workouts, checkins, flags, billing, prep. Query: WHERE coach_id = auth.uid(). NULL when source cannot be computed safely.';
