-- Habit adherence (per-habit percentages, streak) and coach-facing retention signals.
-- Uses: client_habits, client_habit_logs, checkins, workout_sessions, message_threads/message_messages, client_engagement_events.
-- Degrades gracefully if tables/columns missing.

-- 1) v_client_habit_adherence: one row per client per habit
DROP VIEW IF EXISTS public.v_client_habit_adherence;

CREATE VIEW public.v_client_habit_adherence
WITH (security_invoker = on)
AS
WITH RECURSIVE
  today AS (SELECT current_date AS d),
  -- Logs with success flag: boolean -> completed; numeric_min -> value >= target_value; numeric_exact -> value = target_value
  success_days AS (
    SELECT
      l.habit_id,
      l.client_id,
      l.log_date,
      CASE
        WHEN h.target_type = 'boolean' THEN (l.completed = true)
        WHEN h.target_type = 'numeric_min' THEN (l.value IS NOT NULL AND h.target_value IS NOT NULL AND l.value >= h.target_value)
        WHEN h.target_type = 'numeric_exact' THEN (l.value IS NOT NULL AND h.target_value IS NOT NULL AND l.value = h.target_value)
        ELSE false
      END AS success
    FROM public.client_habit_logs l
    JOIN public.client_habits h ON h.id = l.habit_id
  ),
  -- Consecutive successful days backwards from today (recursive)
  streak_base AS (
    SELECT h.id AS habit_id, h.client_id
    FROM public.client_habits h
    WHERE h.is_active = true
  ),
  recur_streak AS (
    SELECT
      sb.habit_id,
      sb.client_id,
      (SELECT d FROM today) AS d,
      1 AS run
    FROM streak_base sb
    WHERE EXISTS (
      SELECT 1 FROM success_days s
      WHERE s.habit_id = sb.habit_id AND s.client_id = sb.client_id
        AND s.log_date = (SELECT d FROM today) AND s.success
    )
    UNION ALL
    SELECT
      r.habit_id,
      r.client_id,
      r.d - 1 AS d,
      r.run + 1 AS run
    FROM recur_streak r
    WHERE EXISTS (
      SELECT 1 FROM success_days s
      WHERE s.habit_id = r.habit_id AND s.client_id = r.client_id
        AND s.log_date = r.d - 1 AND s.success
    )
  ),
  streak_agg AS (
    SELECT habit_id, client_id, COALESCE(max(run), 0)::integer AS current_streak_days
    FROM recur_streak
    GROUP BY habit_id, client_id
  ),
  -- Adherence windows: count successful days in last 7/14/30
  success_7 AS (
    SELECT s.habit_id, s.client_id, count(*)::integer AS cnt
    FROM success_days s
    WHERE s.log_date >= (SELECT d FROM today) - 6 AND s.log_date <= (SELECT d FROM today) AND s.success
    GROUP BY s.habit_id, s.client_id
  ),
  success_14 AS (
    SELECT s.habit_id, s.client_id, count(*)::integer AS cnt
    FROM success_days s
    WHERE s.log_date >= (SELECT d FROM today) - 13 AND s.log_date <= (SELECT d FROM today) AND s.success
    GROUP BY s.habit_id, s.client_id
  ),
  success_30 AS (
    SELECT s.habit_id, s.client_id, count(*)::integer AS cnt
    FROM success_days s
    WHERE s.log_date >= (SELECT d FROM today) - 29 AND s.log_date <= (SELECT d FROM today) AND s.success
    GROUP BY s.habit_id, s.client_id
  ),
  last_logged AS (
    SELECT habit_id, client_id, max(log_date)::date AS last_logged_date
    FROM public.client_habit_logs
    GROUP BY habit_id, client_id
  )
SELECT
  h.client_id,
  h.id AS habit_id,
  h.title AS habit_title,
  h.category,
  round((COALESCE(s7.cnt, 0)::numeric / 7.0) * 100.0, 1) AS adherence_last_7d,
  round((COALESCE(s14.cnt, 0)::numeric / 14.0) * 100.0, 1) AS adherence_last_14d,
  round((COALESCE(s30.cnt, 0)::numeric / 30.0) * 100.0, 1) AS adherence_last_30d,
  COALESCE(st.current_streak_days, 0) AS current_streak_days,
  ll.last_logged_date,
  h.is_active
FROM public.client_habits h
LEFT JOIN success_7 s7 ON s7.habit_id = h.id AND s7.client_id = h.client_id
LEFT JOIN success_14 s14 ON s14.habit_id = h.id AND s14.client_id = h.client_id
LEFT JOIN success_30 s30 ON s30.habit_id = h.id AND s30.client_id = h.client_id
LEFT JOIN streak_agg st ON st.habit_id = h.id AND st.client_id = h.client_id
LEFT JOIN last_logged ll ON ll.habit_id = h.id AND ll.client_id = h.client_id;

COMMENT ON VIEW public.v_client_habit_adherence IS 'Per-habit adherence (7d/14d/30d %), current streak (consecutive successful days from today), last logged. Success: boolean=completed, numeric_min=value>=target, numeric_exact=value=target.';

-- 2) v_client_retention_signals: one row per client, coach-facing
-- Drop dependents first (v_coach_review_queue, v_client_risk, v_client_lifecycle, v_client_retention_risk depend on it)
DROP VIEW IF EXISTS public.v_coach_review_queue;
DROP VIEW IF EXISTS public.v_client_risk;
DROP VIEW IF EXISTS public.v_client_lifecycle;
DROP VIEW IF EXISTS public.v_client_retention_risk;
DROP VIEW IF EXISTS public.v_client_retention_signals;

CREATE VIEW public.v_client_retention_signals
WITH (security_invoker = on)
AS
WITH
  last_checkin AS (
    SELECT
      c.client_id,
      max(c.submitted_at) AS last_at
    FROM public.checkins c
    WHERE c.submitted_at IS NOT NULL
    GROUP BY c.client_id
  ),
  last_workout AS (
    SELECT
      w.client_id,
      max(w.completed_at) AS last_at
    FROM public.workout_sessions w
    WHERE w.status = 'completed' AND w.completed_at IS NOT NULL AND w.client_id IS NOT NULL
    GROUP BY w.client_id
  ),
  last_message AS (
    SELECT
      mt.client_id,
      max(mm.created_at) AS last_at
    FROM public.message_threads mt
    JOIN public.message_messages mm ON mm.thread_id = mt.id
    WHERE mt.deleted_at IS NULL
    GROUP BY mt.client_id
  ),
  engagement_14d AS (
    SELECT
      e.client_id,
      count(*)::integer AS event_count
    FROM public.client_engagement_events e
    WHERE e.created_at >= (now() - interval '14 days')
    GROUP BY e.client_id
  ),
  habit_signals AS (
    SELECT
      a.client_id,
      bool_or(a.adherence_last_7d < 50 AND a.is_active) AS low_habit_adherence,
      bool_or(a.current_streak_days = 0 AND a.is_active AND a.last_logged_date IS NOT NULL) AS habit_streak_broken
    FROM public.v_client_habit_adherence a
    GROUP BY a.client_id
  )
SELECT
  c.id AS client_id,
  COALESCE(c.coach_id, c.trainer_id) AS coach_id,
  (current_date - (lc.last_at::date))::integer AS days_since_last_checkin,
  (current_date - (lw.last_at::date))::integer AS days_since_last_workout,
  (current_date - (lm.last_at::date))::integer AS days_since_last_message,
  COALESCE(hs.low_habit_adherence, false) AS low_habit_adherence,
  COALESCE(hs.habit_streak_broken, false) AS habit_streak_broken,
  least(100, (COALESCE(eng.event_count, 0) * 5))::integer AS engagement_score,
  array_remove(ARRAY[
    CASE WHEN (current_date - (lc.last_at::date)) > 7 THEN 'checkin_overdue' END,
    CASE WHEN (current_date - (lw.last_at::date)) > 14 THEN 'no_recent_workout' END,
    CASE WHEN (current_date - (lm.last_at::date)) > 7 THEN 'no_recent_message' END,
    CASE WHEN hs.low_habit_adherence = true THEN 'low_habit_adherence' END,
    CASE WHEN hs.habit_streak_broken = true THEN 'habit_streak_broken' END
  ], NULL) AS risk_reason,
  round(
    greatest(0, least(100,
      100
      - (CASE WHEN (current_date - (lc.last_at::date)) > 7 THEN 20 ELSE (CASE WHEN (current_date - (lc.last_at::date)) > 3 THEN 10 ELSE 0 END) END)
      - (CASE WHEN (current_date - (lw.last_at::date)) > 14 THEN 15 ELSE 0 END)
      - (CASE WHEN (current_date - (lm.last_at::date)) > 7 THEN 15 ELSE 0 END)
      - (CASE WHEN COALESCE(hs.low_habit_adherence, false) THEN 15 ELSE 0 END)
      - (CASE WHEN COALESCE(hs.habit_streak_broken, false) THEN 10 ELSE 0 END)
      + (least(COALESCE(eng.event_count, 0) * 2, 20))
    )), 1
  )::numeric AS retention_score
FROM public.clients c
LEFT JOIN last_checkin lc ON lc.client_id = c.id
LEFT JOIN last_workout lw ON lw.client_id = c.id
LEFT JOIN last_message lm ON lm.client_id = c.id
LEFT JOIN engagement_14d eng ON eng.client_id = c.id
LEFT JOIN habit_signals hs ON hs.client_id = c.id;

COMMENT ON VIEW public.v_client_retention_signals IS 'Coach-facing retention: days since checkin/workout/message, habit flags, engagement (14d events), risk_reason[], retention_score 0-100.';

-- 3) Recreate v_client_retention_risk (dropped above) so v_coach_review_queue in next migration can use it
CREATE VIEW public.v_client_retention_risk
WITH (security_invoker = on)
AS
SELECT
  s.client_id,
  s.coach_id,
  COALESCE(c.name, '')::text AS client_name,
  (100 - GREATEST(0, LEAST(100, COALESCE(s.retention_score, 50))))::int AS risk_score,
  CASE
    WHEN (100 - GREATEST(0, LEAST(100, COALESCE(s.retention_score, 50)))) <= 20 THEN 'healthy'
    WHEN (100 - GREATEST(0, LEAST(100, COALESCE(s.retention_score, 50)))) <= 40 THEN 'watch'
    WHEN (100 - GREATEST(0, LEAST(100, COALESCE(s.retention_score, 50)))) <= 60 THEN 'at_risk'
    ELSE 'churn_risk'
  END AS risk_band,
  COALESCE(s.risk_reason, ARRAY[]::text[]) AS reasons
FROM public.v_client_retention_signals s
JOIN public.clients c ON c.id = s.client_id;

COMMENT ON VIEW public.v_client_retention_risk IS 'Retention risk per client: risk_score 0–100 (inverted from retention_score), risk_band (healthy|watch|at_risk|churn_risk), reasons[]. Built on v_client_retention_signals.';

-- 4) Recreate v_client_lifecycle (dropped above)
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

COMMENT ON VIEW public.v_client_lifecycle IS 'Per-client lifecycle: lifecycle_stage (stored) and effective_stage (stored or derived from risk_band).';

-- 5) Recreate v_client_risk (dropped above)
CREATE VIEW public.v_client_risk
WITH (security_invoker = on)
AS
SELECT
  r.client_id,
  r.risk_score,
  NULLIF(TRIM(array_to_string(COALESCE(r.reasons, ARRAY[]::text[]), ', ')), '') AS risk_reason
FROM public.v_client_retention_risk r;

COMMENT ON VIEW public.v_client_risk IS 'At-risk client summary: client_id, risk_score (0–100), risk_reason. Use WHERE risk_score >= 40 for at-risk.';

-- ---------------------------------------------------------------------------
-- Scoring logic summary
-- ---------------------------------------------------------------------------
-- v_client_habit_adherence:
--   Success rules: boolean -> completed = true; numeric_min -> value >= target_value; numeric_exact -> value = target_value.
--   adherence_last_7d/14d/30d: (count of successful days in window / window length) * 100.
--   current_streak_days: consecutive days backwards from today where each day has a successful log (recursive CTE).
--   last_logged_date: max(log_date) for that habit.
--
-- v_client_retention_signals:
--   days_since_last_checkin: current_date - date(max(checkins.submitted_at)); null if never.
--   days_since_last_workout: current_date - date(max(workout_sessions.completed_at)) where status='completed'; null if never.
--   days_since_last_message: current_date - date(max(message_messages.created_at)) via message_threads; null if never.
--   low_habit_adherence: true if any active habit has adherence_last_7d < 50.
--   habit_streak_broken: true if any active habit has current_streak_days = 0 and has logged at least once.
--   engagement_score: min(100, event_count_14d * 5) from client_engagement_events.
--   risk_reason: array of 'checkin_overdue' (>7d), 'no_recent_workout' (>14d), 'no_recent_message' (>7d), 'low_habit_adherence', 'habit_streak_broken'.
--   retention_score: 0-100, base 100 minus penalties (checkin 10-20, workout 15, message 15, low_habit 15, streak_broken 10) plus engagement bonus (events*2, cap 20).
