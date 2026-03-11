-- Atlas Momentum: calculated weekly adherence scores per client (view).
-- training = workouts_completed / workouts_assigned; nutrition/steps/sleep from checkin; checkin = 100 if submitted; total = weighted average.

DROP VIEW IF EXISTS public.v_client_momentum;

CREATE VIEW public.v_client_momentum
WITH (security_invoker = on)
AS
WITH
  -- All (client_id, week_start) from checkins or workout_sessions
  client_weeks AS (
    SELECT DISTINCT client_id, week_start::date AS week_start
    FROM public.checkins
    UNION
    SELECT DISTINCT client_id, (date_trunc('week', started_at)::date)::date AS week_start
    FROM public.workout_sessions
    WHERE client_id IS NOT NULL
  ),
  -- Workouts assigned per (client_id, week_start): program_days in that week for active assignment
  assigned AS (
    SELECT
      pba.client_id,
      (pba.start_date + ((pw.week_number - 1) * 7))::date AS week_start,
      count(pd.id)::int AS workouts_assigned
    FROM public.program_block_assignments pba
    JOIN public.program_blocks pb ON pb.id = pba.program_block_id
    JOIN public.program_weeks pw ON pw.block_id = pb.id AND pw.week_number <= pb.total_weeks
    JOIN public.program_days pd ON pd.week_id = pw.id
    WHERE pba.is_active = true
    GROUP BY pba.client_id, pba.start_date, pw.week_number
  ),
  -- Workouts completed per (client_id, week_start)
  completed AS (
    SELECT
      client_id,
      (date_trunc('week', COALESCE(completed_at, started_at))::date)::date AS week_start,
      count(*)::int AS workouts_completed
    FROM public.workout_sessions
    WHERE client_id IS NOT NULL AND status = 'completed'
    GROUP BY client_id, (date_trunc('week', COALESCE(completed_at, started_at))::date)
  ),
  -- One checkin per (client_id, week_start): nutrition, steps, sleep, and whether submitted
  ch AS (
    SELECT
      client_id,
      week_start,
      nutrition_adherence,
      steps_avg,
      sleep_score,
      CASE WHEN submitted_at IS NOT NULL THEN 100 ELSE 0 END AS checkin_score
    FROM public.checkins
  )
SELECT
  cw.client_id,
  cw.week_start,
  -- training_score: completed/assigned as 0-100, NULL if no assigned
  (CASE
    WHEN a.workouts_assigned IS NOT NULL AND a.workouts_assigned > 0 THEN
      LEAST(100, (COALESCE(c.workouts_completed, 0)::numeric / a.workouts_assigned) * 100)
    ELSE NULL
  END)::numeric AS training_score,
  -- nutrition_score: avg nutrition adherence (single checkin value per week)
  ch.nutrition_adherence::numeric AS nutrition_score,
  -- steps_score: steps completion (use checkin steps_avg as 0-100 score; if not 0-100 scale, use as-is)
  ch.steps_avg::numeric AS steps_score,
  -- sleep_score: sleep target adherence
  ch.sleep_score::numeric AS sleep_score,
  -- checkin_score: 100 if checkin submitted, else 0
  COALESCE(ch.checkin_score, 0)::numeric AS checkin_score,
  -- total_score: equal-weight average of present components (missing = not counted)
  (
    COALESCE((CASE WHEN a.workouts_assigned IS NOT NULL AND a.workouts_assigned > 0 THEN LEAST(100, (COALESCE(c.workouts_completed, 0)::numeric / a.workouts_assigned) * 100) END), 0)
    + COALESCE(ch.nutrition_adherence, 0)
    + COALESCE(ch.steps_avg, 0)
    + COALESCE(ch.sleep_score, 0)
    + COALESCE(ch.checkin_score, 0)
  ) / NULLIF(
    (CASE WHEN a.workouts_assigned IS NOT NULL AND a.workouts_assigned > 0 THEN 1 ELSE 0 END)
    + (CASE WHEN ch.nutrition_adherence IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN ch.steps_avg IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN ch.sleep_score IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN ch.checkin_score IS NOT NULL THEN 1 ELSE 0 END),
    0
  )::numeric AS total_score
FROM client_weeks cw
LEFT JOIN assigned a ON a.client_id = cw.client_id AND a.week_start = cw.week_start
LEFT JOIN completed c ON c.client_id = cw.client_id AND c.week_start = cw.week_start
LEFT JOIN ch ON ch.client_id = cw.client_id AND ch.week_start = cw.week_start;

COMMENT ON VIEW public.v_client_momentum IS 'Atlas Momentum: weekly adherence (training, nutrition, steps, sleep, checkin, total). training=completed/assigned; checkin=100 if submitted; total=equal-weight avg of present scores. Query: WHERE client_id = ? OR client_id IN (SELECT id FROM clients WHERE coach_id = auth.uid()).';
