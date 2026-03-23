-- Adaptive training recommendation summary per coach.

CREATE OR REPLACE VIEW public.v_adaptive_training_summary
WITH (security_invoker = true)
AS
SELECT
  coach_id,
  COUNT(*)::int AS total_recommendations,
  COUNT(*) FILTER (WHERE status = 'applied')::int AS applied_recommendations,
  COUNT(*) FILTER (WHERE status = 'ignored')::int AS ignored_recommendations,
  COUNT(*) FILTER (WHERE severity = 'high')::int AS high_severity_count,
  COUNT(*) FILTER (WHERE recommendation_type = 'deload_recommendation')::int AS deload_recommendations,
  COUNT(*) FILTER (WHERE recommendation_type = 'recovery_session')::int AS recovery_session_recommendations
FROM public.training_adjustment_recommendations
WHERE coach_id IS NOT NULL
GROUP BY coach_id;

COMMENT ON VIEW public.v_adaptive_training_summary IS
'Per-coach adaptive recommendation analytics: total, applied, ignored, high severity, deload, and recovery-session recommendation counts.';
