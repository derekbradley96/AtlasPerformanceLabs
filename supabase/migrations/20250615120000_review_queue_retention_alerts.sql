-- Retention alerts in Review Center: habit_adherence_low, streak_broken, momentum_low, no_checkin, no_workout.
-- Extends review_queue_dismissals and v_coach_review_queue. Uses v_client_retention_signals, v_client_momentum.

-- 1) Allow new item types in dismissals
ALTER TABLE public.review_queue_dismissals
  DROP CONSTRAINT IF EXISTS review_queue_dismissals_item_type_check;

ALTER TABLE public.review_queue_dismissals
  ADD CONSTRAINT review_queue_dismissals_item_type_check
  CHECK (item_type IN (
    'retention_risk', 'billing_overdue', 'flag', 'momentum_dropping',
    'habit_adherence_low', 'momentum_low', 'streak_broken', 'no_checkin', 'no_workout'
  ));

-- 2) Recreate view with new CTEs (depends on v_client_retention_signals, v_client_momentum)
DROP VIEW IF EXISTS public.v_coach_review_queue;

CREATE VIEW public.v_coach_review_queue
WITH (security_invoker = on)
AS
WITH
  current_week AS (SELECT (date_trunc('week', current_date)::date)::date AS week_start),
  coach_clients AS (
    SELECT c.id AS client_id, COALESCE(c.coach_id, c.trainer_id) AS coach_id, COALESCE(c.name, '')::text AS client_name
    FROM public.clients c
    WHERE COALESCE(c.coach_id, c.trainer_id) IS NOT NULL
  ),

  checkin_new AS (
    SELECT cc.coach_id, cc.client_id, cc.client_name, 'checkin'::text AS item_type, 80 AS priority,
      ARRAY['new_checkin_48h']::text[] AS reasons, ch.submitted_at AS created_at,
      jsonb_build_object('checkin_id', ch.id, 'week_start', ch.week_start) AS payload, ch.reviewed_at AS resolved_at
    FROM public.checkins ch
    JOIN coach_clients cc ON cc.client_id = ch.client_id
    WHERE ch.submitted_at >= (now() - interval '48 hours') AND ch.reviewed_at IS NULL
  ),
  checkin_missed AS (
    SELECT cc.coach_id, cc.client_id, cc.client_name, 'checkin'::text AS item_type, 90 AS priority,
      ARRAY['missed_checkin']::text[] AS reasons, (SELECT week_start FROM current_week)::timestamptz AS created_at,
      jsonb_build_object('week_start', (SELECT week_start FROM current_week)) AS payload, NULL::timestamptz AS resolved_at
    FROM coach_clients cc
    WHERE NOT EXISTS (SELECT 1 FROM public.checkins ch WHERE ch.client_id = cc.client_id AND ch.week_start = (SELECT week_start FROM current_week))
  ),
  pose_new AS (
    SELECT cc.coach_id, cc.client_id, cc.client_name, 'pose_check'::text AS item_type, 75 AS priority,
      ARRAY['new_pose_check_48h']::text[] AS reasons, pc.submitted_at AS created_at,
      jsonb_build_object('pose_check_id', pc.id, 'week_start', pc.week_start) AS payload, pc.reviewed_at AS resolved_at
    FROM public.pose_checks pc JOIN coach_clients cc ON cc.client_id = pc.client_id
    WHERE pc.submitted_at >= (now() - interval '48 hours') AND pc.reviewed_at IS NULL
  ),
  pose_due AS (
    SELECT cc.coach_id, cc.client_id, cc.client_name, 'pose_check'::text AS item_type, 85 AS priority,
      ARRAY['pose_check_due']::text[] AS reasons, (SELECT week_start FROM current_week)::timestamptz AS created_at,
      jsonb_build_object('week_start', (SELECT week_start FROM current_week)) AS payload, NULL::timestamptz AS resolved_at
    FROM coach_clients cc
    WHERE NOT EXISTS (SELECT 1 FROM public.pose_checks pc WHERE pc.client_id = cc.client_id AND pc.week_start = (SELECT week_start FROM current_week))
  ),
  retention_high AS (
    SELECT r.coach_id, r.client_id, r.client_name, 'retention_risk'::text AS item_type, 70 AS priority,
      COALESCE(r.reasons, '{}'::text[]) AS reasons, now()::timestamptz AS created_at,
      jsonb_build_object('risk_score', r.risk_score, 'risk_band', r.risk_band) AS payload, d.resolved_at AS resolved_at
    FROM public.v_client_retention_risk r
    LEFT JOIN public.review_queue_dismissals d ON d.coach_id = r.coach_id AND d.client_id = r.client_id AND d.item_type = 'retention_risk'
    WHERE r.risk_band IN ('at_risk', 'churn_risk')
  ),
  billing_overdue AS (
    SELECT cc.coach_id, cc.client_id, cc.client_name, 'billing_overdue'::text AS item_type, 65 AS priority,
      ARRAY['payment_overdue']::text[] AS reasons, now() AS created_at,
      jsonb_build_object('next_due_date', c.next_due_date, 'monthly_fee', c.monthly_fee) AS payload, d.resolved_at AS resolved_at
    FROM public.clients c JOIN coach_clients cc ON cc.client_id = c.id
    LEFT JOIN public.review_queue_dismissals d ON d.coach_id = cc.coach_id AND d.client_id = cc.client_id AND d.item_type = 'billing_overdue'
    WHERE c.billing_status = 'overdue'
  ),
  flag_active AS (
    SELECT cs.coach_id, cs.client_id, cc.client_name, 'flag'::text AS item_type, 60 AS priority,
      ARRAY['active_flags']::text[] AS reasons, cs.updated_at AS created_at,
      jsonb_build_object('active_flags_count', cs.active_flags_count) AS payload, d.resolved_at AS resolved_at
    FROM public.client_state cs
    JOIN coach_clients cc ON cc.client_id = cs.client_id AND cc.coach_id = cs.coach_id
    LEFT JOIN public.review_queue_dismissals d ON d.coach_id = cs.coach_id AND d.client_id = cs.client_id AND d.item_type = 'flag'
    WHERE cs.active_flags_count > 0
  ),
  momentum_dropping AS (
    SELECT cc.coach_id, cc.client_id, cc.client_name, 'momentum_dropping'::text AS item_type, 72 AS priority,
      ARRAY['client_momentum_dropping']::text[] AS reasons, now() AS created_at,
      jsonb_build_object('week_start', m.week_start, 'total_score', m.total_score) AS payload, d.resolved_at AS resolved_at
    FROM public.v_client_momentum m
    JOIN coach_clients cc ON cc.client_id = m.client_id
    LEFT JOIN public.review_queue_dismissals d ON d.coach_id = cc.coach_id AND d.client_id = cc.client_id AND d.item_type = 'momentum_dropping'
    WHERE m.week_start = (SELECT week_start FROM current_week) AND m.total_score IS NOT NULL AND m.total_score < 60
  ),

  -- Retention alerts from v_client_retention_signals (requires view to exist)
  habit_adherence_low AS (
    SELECT r.coach_id, r.client_id, cc.client_name, 'habit_adherence_low'::text AS item_type, 58 AS priority,
      ARRAY['low_habit_adherence']::text[] AS reasons, now()::timestamptz AS created_at,
      jsonb_build_object('retention_score', r.retention_score) AS payload, d.resolved_at AS resolved_at
    FROM public.v_client_retention_signals r
    JOIN coach_clients cc ON cc.client_id = r.client_id AND cc.coach_id = r.coach_id
    LEFT JOIN public.review_queue_dismissals d ON d.coach_id = r.coach_id AND d.client_id = r.client_id AND d.item_type = 'habit_adherence_low'
    WHERE r.low_habit_adherence = true
  ),
  streak_broken AS (
    SELECT r.coach_id, r.client_id, cc.client_name, 'streak_broken'::text AS item_type, 57 AS priority,
      ARRAY['habit_streak_broken']::text[] AS reasons, now()::timestamptz AS created_at,
      jsonb_build_object('retention_score', r.retention_score) AS payload, d.resolved_at AS resolved_at
    FROM public.v_client_retention_signals r
    JOIN coach_clients cc ON cc.client_id = r.client_id AND cc.coach_id = r.coach_id
    LEFT JOIN public.review_queue_dismissals d ON d.coach_id = r.coach_id AND d.client_id = r.client_id AND d.item_type = 'streak_broken'
    WHERE r.habit_streak_broken = true
  ),
  momentum_low AS (
    SELECT cc.coach_id, cc.client_id, cc.client_name, 'momentum_low'::text AS item_type, 56 AS priority,
      ARRAY['momentum_low']::text[] AS reasons, now() AS created_at,
      jsonb_build_object('week_start', m.week_start, 'total_score', m.total_score) AS payload, d.resolved_at AS resolved_at
    FROM public.v_client_momentum m
    JOIN coach_clients cc ON cc.client_id = m.client_id
    LEFT JOIN public.review_queue_dismissals d ON d.coach_id = cc.coach_id AND d.client_id = cc.client_id AND d.item_type = 'momentum_low'
    WHERE m.week_start = (SELECT week_start FROM current_week) AND m.total_score IS NOT NULL AND m.total_score < 50
  ),
  no_checkin AS (
    SELECT r.coach_id, r.client_id, cc.client_name, 'no_checkin'::text AS item_type, 55 AS priority,
      ARRAY['no_checkin']::text[] AS reasons, now()::timestamptz AS created_at,
      jsonb_build_object('days_since_last_checkin', r.days_since_last_checkin) AS payload, d.resolved_at AS resolved_at
    FROM public.v_client_retention_signals r
    JOIN coach_clients cc ON cc.client_id = r.client_id AND cc.coach_id = r.coach_id
    LEFT JOIN public.review_queue_dismissals d ON d.coach_id = r.coach_id AND d.client_id = r.client_id AND d.item_type = 'no_checkin'
    WHERE (r.days_since_last_checkin IS NULL OR r.days_since_last_checkin > 7)
  ),
  no_workout AS (
    SELECT r.coach_id, r.client_id, cc.client_name, 'no_workout'::text AS item_type, 54 AS priority,
      ARRAY['no_workout']::text[] AS reasons, now()::timestamptz AS created_at,
      jsonb_build_object('days_since_last_workout', r.days_since_last_workout) AS payload, d.resolved_at AS resolved_at
    FROM public.v_client_retention_signals r
    JOIN coach_clients cc ON cc.client_id = r.client_id AND cc.coach_id = r.coach_id
    LEFT JOIN public.review_queue_dismissals d ON d.coach_id = r.coach_id AND d.client_id = r.client_id AND d.item_type = 'no_workout'
    WHERE (r.days_since_last_workout IS NULL OR r.days_since_last_workout > 14)
  )

SELECT coach_id, client_id, client_name, item_type, priority, reasons, created_at, payload, resolved_at FROM checkin_new
UNION ALL SELECT coach_id, client_id, client_name, item_type, priority, reasons, created_at, payload, resolved_at FROM checkin_missed
UNION ALL SELECT coach_id, client_id, client_name, item_type, priority, reasons, created_at, payload, resolved_at FROM pose_new
UNION ALL SELECT coach_id, client_id, client_name, item_type, priority, reasons, created_at, payload, resolved_at FROM pose_due
UNION ALL SELECT coach_id, client_id, client_name, item_type, priority, reasons, created_at, payload, resolved_at FROM retention_high
UNION ALL SELECT coach_id, client_id, client_name, item_type, priority, reasons, created_at, payload, resolved_at FROM billing_overdue
UNION ALL SELECT coach_id, client_id, client_name, item_type, priority, reasons, created_at, payload, resolved_at FROM flag_active
UNION ALL SELECT coach_id, client_id, client_name, item_type, priority, reasons, created_at, payload, resolved_at FROM momentum_dropping
UNION ALL SELECT coach_id, client_id, client_name, item_type, priority, reasons, created_at, payload, resolved_at FROM habit_adherence_low
UNION ALL SELECT coach_id, client_id, client_name, item_type, priority, reasons, created_at, payload, resolved_at FROM streak_broken
UNION ALL SELECT coach_id, client_id, client_name, item_type, priority, reasons, created_at, payload, resolved_at FROM momentum_low
UNION ALL SELECT coach_id, client_id, client_name, item_type, priority, reasons, created_at, payload, resolved_at FROM no_checkin
UNION ALL SELECT coach_id, client_id, client_name, item_type, priority, reasons, created_at, payload, resolved_at FROM no_workout;

COMMENT ON VIEW public.v_coach_review_queue IS 'Unified review queue: checkin, pose_check, retention_risk, billing_overdue, flag, momentum_dropping, habit_adherence_low, streak_broken, momentum_low, no_checkin, no_workout.';
