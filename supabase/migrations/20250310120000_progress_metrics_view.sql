-- Unified progress analytics: one row per client for trends and coaching insights.
-- Uses: checkins, client_compliance, client_flags (via client_state), client_phases, contest_preps, client_state.
-- Missing source data returns NULL for that column.

DROP VIEW IF EXISTS public.v_client_progress_metrics;

CREATE VIEW public.v_client_progress_metrics
WITH (security_invoker = on)
AS
WITH
  -- Latest and previous checkin per client (uses index checkins_client_id_submitted_at_idx)
  ch_ranked AS (
    SELECT
      client_id,
      weight,
      sleep_score,
      energy_level,
      steps_avg,
      submitted_at,
      row_number() OVER (PARTITION BY client_id ORDER BY submitted_at DESC NULLS LAST) AS rn
    FROM public.checkins
  ),
  ch_latest AS (
    SELECT
      a.client_id,
      a.weight AS latest_weight,
      a.sleep_score AS latest_sleep_score,
      a.energy_level AS latest_energy_level,
      a.steps_avg AS latest_steps_avg,
      a.submitted_at AS latest_checkin_at,
      b.weight AS previous_weight
    FROM ch_ranked a
    LEFT JOIN ch_ranked b ON b.client_id = a.client_id AND b.rn = 2
    WHERE a.rn = 1
  ),
  -- Checkin count last 4 weeks
  checkins_4w AS (
    SELECT client_id, count(*)::int AS cnt
    FROM public.checkins
    WHERE submitted_at >= (now() - interval '4 weeks')
    GROUP BY client_id
  ),
  -- Average compliance last 4 weeks (training + nutrition / 2 when both present)
  compliance_4w AS (
    SELECT
      client_id,
      avg(
        (COALESCE(training_adherence_pct, 0) + COALESCE(nutrition_adherence_pct, 0))
        / NULLIF((CASE WHEN training_adherence_pct IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN nutrition_adherence_pct IS NOT NULL THEN 1 ELSE 0 END), 0)
      )::numeric AS avg_compliance
    FROM public.client_compliance
    WHERE recorded_at >= (now() - interval '4 weeks')
    GROUP BY client_id
  ),
  -- Latest phase per client and current week in phase
  latest_phase AS (
    SELECT DISTINCT ON (client_id)
      client_id,
      phase_type AS latest_phase_type,
      start_date,
      block_length_weeks,
      LEAST(
        GREATEST(1, FLOOR((CURRENT_DATE - start_date) / 7)::int + 1),
        block_length_weeks
      )::int AS current_phase_week
    FROM public.client_phases
    ORDER BY client_id, start_date DESC NULLS LAST
  ),
  -- Active prep per client (at most one is_active = true)
  active_prep AS (
    SELECT
      client_id,
      show_date,
      (show_date - CURRENT_DATE)::int AS days_out
    FROM public.contest_preps
    WHERE is_active = true
  )
SELECT
  c.id AS client_id,
  COALESCE(c.coach_id, c.trainer_id) AS coach_id,
  ch.latest_weight,
  ch.previous_weight,
  (ch.latest_weight - ch.previous_weight)::numeric AS weight_change,
  ch.latest_checkin_at AS latest_checkin_at,
  COALESCE(c4.cnt, 0)::int AS checkins_last_4w,
  comp.avg_compliance AS avg_compliance_last_4w,
  ch.latest_sleep_score,
  ch.latest_energy_level,
  ch.latest_steps_avg,
  COALESCE(cs.active_flags_count, 0)::int AS active_flags_count,
  lp.latest_phase_type,
  lp.current_phase_week,
  (ap.client_id IS NOT NULL) AS has_active_prep,
  ap.show_date AS show_date,
  ap.days_out AS days_out
FROM public.clients c
LEFT JOIN ch_latest ch ON ch.client_id = c.id
LEFT JOIN public.client_state cs ON cs.client_id = c.id
LEFT JOIN checkins_4w c4 ON c4.client_id = c.id
LEFT JOIN compliance_4w comp ON comp.client_id = c.id
LEFT JOIN latest_phase lp ON lp.client_id = c.id
LEFT JOIN active_prep ap ON ap.client_id = c.id;

COMMENT ON VIEW public.v_client_progress_metrics IS 'One row per client: weight trend, checkin/compliance counts, latest checkin metrics, flags, phase, prep. Query: WHERE coach_id = auth.uid().';
