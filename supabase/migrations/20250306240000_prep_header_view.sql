-- Prep header view for clients with an active contest prep.
-- Requires: contest_preps (is_active, show_date), pose_checks.

DROP VIEW IF EXISTS public.v_client_prep_header;

CREATE VIEW public.v_client_prep_header
WITH (security_invoker = on)
AS
WITH
  current_week_monday AS (
    SELECT (date_trunc('week', current_date)::date)::date AS week_start
  )
SELECT
  p.client_id,
  p.id AS prep_id,
  p.show_date,
  floor((p.show_date - current_date)::numeric / 7)::integer AS weeks_out,
  (p.show_date - current_date)::integer AS days_out,
  ((p.show_date - current_date) >= 0 AND (p.show_date - current_date) <= 7) AS is_peak_week,
  (SELECT week_start FROM current_week_monday) AS next_pose_check_week_start,
  EXISTS (
    SELECT 1 FROM public.pose_checks pc
    WHERE pc.client_id = p.client_id
      AND pc.week_start = (SELECT week_start FROM current_week_monday)
  ) AS pose_check_submitted_this_week
FROM public.contest_preps p
WHERE p.is_active = true;

COMMENT ON VIEW public.v_client_prep_header IS 'One row per client with active contest prep: weeks_out, days_out, is_peak_week, pose check status. Query: WHERE client_id = $id.';
