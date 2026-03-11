-- Add prep_id and protocol_ready to v_peak_week_clients for Command Center protocol actions.
DROP VIEW IF EXISTS public.v_peak_week_clients;

CREATE VIEW public.v_peak_week_clients
WITH (security_invoker = on)
AS
WITH
  current_week_monday AS (
    SELECT (date_trunc('week', current_date)::date)::date AS week_start
  ),
  prep_in_window AS (
    SELECT
      p.id AS prep_id,
      p.client_id,
      p.show_name,
      p.division,
      p.show_date,
      (p.show_date - current_date)::int AS days_out
    FROM public.contest_preps p
    WHERE p.is_active = true
      AND (p.show_date - current_date)::int <= 14
      AND (p.show_date - current_date)::int >= 0
  ),
  ch_ranked AS (
    SELECT
      client_id,
      weight,
      row_number() OVER (PARTITION BY client_id ORDER BY submitted_at DESC NULLS LAST) AS rn
    FROM public.checkins
    WHERE weight IS NOT NULL
  ),
  ch_latest AS (
    SELECT
      a.client_id,
      a.weight AS weight_latest,
      b.weight AS weight_previous
    FROM ch_ranked a
    LEFT JOIN ch_ranked b ON b.client_id = a.client_id AND b.rn = 2
    WHERE a.rn = 1
  ),
  pose_this_week AS (
    SELECT pc.client_id, true AS submitted
    FROM public.pose_checks pc
    CROSS JOIN current_week_monday cw
    WHERE pc.week_start = cw.week_start
  ),
  latest_phase AS (
    SELECT DISTINCT ON (client_id)
      client_id,
      LEAST(
        GREATEST(1, FLOOR((CURRENT_DATE - start_date) / 7)::int + 1),
        block_length_weeks
      )::int AS current_phase_week
    FROM public.client_phases
    ORDER BY client_id, start_date DESC NULLS LAST
  )
SELECT
  c.id AS client_id,
  COALESCE(c.coach_id, c.trainer_id) AS coach_id,
  COALESCE(c.name, '')::text AS client_name,
  pw.prep_id,
  pw.show_name,
  pw.division,
  pw.show_date,
  pw.days_out,
  (pwp.id IS NOT NULL) AS protocol_ready,
  ch.weight_latest AS weight_latest,
  (ch.weight_latest - ch.weight_previous)::numeric AS weight_change_last_checkin,
  (ptw.submitted = true) AS pose_check_submitted_this_week,
  COALESCE(cs.active_flags_count, 0)::int AS active_flags_count,
  lp.current_phase_week AS prep_phase_week
FROM public.clients c
JOIN prep_in_window pw ON pw.client_id = c.id
LEFT JOIN public.peak_week_protocols pwp ON pwp.client_id = c.id AND pwp.contest_prep_id = pw.prep_id
LEFT JOIN ch_latest ch ON ch.client_id = c.id
LEFT JOIN pose_this_week ptw ON ptw.client_id = c.id
LEFT JOIN public.client_state cs ON cs.client_id = c.id
LEFT JOIN latest_phase lp ON lp.client_id = c.id;

COMMENT ON VIEW public.v_peak_week_clients IS 'Peak Week Command Center: clients with active contest prep and show in ≤14 days. Includes prep_id and protocol_ready.';
