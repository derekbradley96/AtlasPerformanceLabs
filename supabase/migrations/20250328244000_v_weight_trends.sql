-- Weight trends per client: latest, previous, weekly change and direction from checkins.

DROP VIEW IF EXISTS public.v_weight_trends;

CREATE VIEW public.v_weight_trends
WITH (security_invoker = on)
AS
WITH
  ranked AS (
    SELECT
      client_id,
      weight,
      row_number() OVER (PARTITION BY client_id ORDER BY submitted_at DESC NULLS LAST) AS rn
    FROM public.checkins
    WHERE weight IS NOT NULL
  ),
  latest_prev AS (
    SELECT
      a.client_id,
      a.weight AS latest_weight,
      b.weight AS previous_weight
    FROM ranked a
    LEFT JOIN ranked b ON b.client_id = a.client_id AND b.rn = 2
    WHERE a.rn = 1
  )
SELECT
  client_id,
  latest_weight,
  previous_weight,
  (latest_weight - previous_weight)::numeric AS weekly_change,
  CASE
    WHEN previous_weight IS NULL THEN 'stable'::text
    WHEN latest_weight > previous_weight THEN 'up'::text
    WHEN latest_weight < previous_weight THEN 'down'::text
    ELSE 'stable'::text
  END AS trend_direction
FROM latest_prev;

COMMENT ON VIEW public.v_weight_trends IS 'Per-client weight trend from checkins: latest_weight, previous_weight, weekly_change (delta), trend_direction (up/down/stable).';
