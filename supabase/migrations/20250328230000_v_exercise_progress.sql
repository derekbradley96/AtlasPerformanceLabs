-- View: last vs previous performance per (client_id, exercise_id) with progression (weight delta).

DROP VIEW IF EXISTS public.v_exercise_progress;

CREATE VIEW public.v_exercise_progress
WITH (security_invoker = on)
AS
WITH ranked AS (
  SELECT
    client_id,
    exercise_id,
    weight,
    reps,
    created_at,
    row_number() OVER (
      PARTITION BY client_id, exercise_id
      ORDER BY created_at DESC NULLS LAST
    ) AS rn
  FROM public.exercise_performance
  WHERE exercise_id IS NOT NULL
),
last_rec AS (
  SELECT client_id, exercise_id, weight AS last_weight, reps AS last_reps
  FROM ranked
  WHERE rn = 1
),
prev_rec AS (
  SELECT client_id, exercise_id, weight AS previous_weight, reps AS previous_reps
  FROM ranked
  WHERE rn = 2
)
SELECT
  l.client_id,
  l.exercise_id,
  l.last_weight,
  l.last_reps,
  p.previous_weight,
  p.previous_reps,
  (l.last_weight - p.previous_weight)::numeric AS progression
FROM last_rec l
LEFT JOIN prev_rec p
  ON p.client_id = l.client_id AND p.exercise_id = l.exercise_id;

COMMENT ON VIEW public.v_exercise_progress IS 'Per (client_id, exercise_id): last and previous weight/reps from exercise_performance; progression = last_weight - previous_weight.';
