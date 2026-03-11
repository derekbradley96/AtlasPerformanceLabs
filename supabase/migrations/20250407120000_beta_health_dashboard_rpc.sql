-- Internal beta health dashboard: RPC for admin-only aggregate metrics.
-- Caller must be in beta_feedback_admins. Returns one JSONB with all metrics.

CREATE OR REPLACE FUNCTION public.get_beta_health_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  week_start timestamptz;
  total_beta int;
  beta_coaches int;
  beta_clients int;
  coaches_active_7d int;
  clients_active_7d int;
  feedback_count int;
  activated int;
  checkins_7d bigint;
  workout_events_7d bigint;
  result jsonb;
  top_events jsonb;
  top_friction jsonb;
BEGIN
  uid := auth.uid();
  IF uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.beta_feedback_admins WHERE user_id = uid) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  week_start := date_trunc('week', now())::timestamptz;

  -- Total beta users
  SELECT COUNT(*)::int INTO total_beta FROM public.profiles WHERE is_beta_user = true;

  -- Beta coaches (role coach or trainer)
  SELECT COUNT(*)::int INTO beta_coaches FROM public.profiles
  WHERE is_beta_user = true AND LOWER(COALESCE(role, '')) IN ('coach', 'trainer');

  -- Beta clients
  SELECT COUNT(*)::int INTO beta_clients FROM public.profiles
  WHERE is_beta_user = true AND LOWER(COALESCE(role, '')) = 'client';

  -- Beta coaches active this week (had any platform_usage_event in last 7 days)
  SELECT COUNT(DISTINCT e.user_id)::int INTO coaches_active_7d
  FROM public.platform_usage_events e
  JOIN public.profiles p ON p.id = e.user_id
  WHERE p.is_beta_user = true AND LOWER(COALESCE(p.role, '')) IN ('coach', 'trainer')
    AND e.created_at >= now() - interval '7 days';

  -- Beta clients active this week
  SELECT COUNT(DISTINCT e.user_id)::int INTO clients_active_7d
  FROM public.platform_usage_events e
  JOIN public.profiles p ON p.id = e.user_id
  WHERE p.is_beta_user = true AND LOWER(COALESCE(p.role, '')) = 'client'
    AND e.created_at >= now() - interval '7 days';

  -- Feedback submitted count
  SELECT COUNT(*)::int INTO feedback_count FROM public.beta_feedback;

  -- Activation: beta users with at least one of client_created, program_assigned, message_sent, workout_logged
  SELECT COUNT(DISTINCT user_id)::int INTO activated FROM public.platform_usage_events
  WHERE user_id IN (SELECT id FROM public.profiles WHERE is_beta_user = true)
    AND event_name IN ('client_created', 'program_assigned', 'message_sent', 'workout_logged');

  -- Top event names (proxy for "screens/actions used") – last 7 days
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) INTO top_events FROM (
    SELECT jsonb_build_object('event_name', event_name, 'count', cnt) AS row FROM (
      SELECT event_name, COUNT(*)::bigint AS cnt
      FROM public.platform_usage_events
      WHERE created_at >= now() - interval '7 days'
      GROUP BY event_name
      ORDER BY cnt DESC
      LIMIT 10
    ) sub
  ) agg;

  -- Top friction events – all time or last 7 days
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) INTO top_friction FROM (
    SELECT jsonb_build_object('event_name', event_name, 'count', cnt) AS row FROM (
      SELECT event_name, COUNT(*)::bigint AS cnt
      FROM public.platform_usage_events
      WHERE event_name IN (
        'onboarding_abandoned', 'import_failed', 'program_builder_abandoned',
        'checkin_submit_failed', 'message_send_failed', 'workout_start_failed', 'recoverable_error'
      )
      GROUP BY event_name
      ORDER BY cnt DESC
      LIMIT 10
    ) sub
  ) agg;

  -- Check-ins in last 7 days
  SELECT COUNT(*) INTO checkins_7d FROM public.checkins
  WHERE submitted_at >= now() - interval '7 days';

  -- Workout_logged events in last 7 days
  SELECT COUNT(*) INTO workout_events_7d FROM public.platform_usage_events
  WHERE event_name = 'workout_logged' AND created_at >= now() - interval '7 days';

  result := jsonb_build_object(
    'total_beta_users', total_beta,
    'beta_coaches_active_this_week', coaches_active_7d,
    'beta_clients_active_this_week', clients_active_7d,
    'feedback_submitted_count', feedback_count,
    'activation_completion_rate', CASE WHEN total_beta > 0 THEN ROUND(100.0 * activated / total_beta, 1) ELSE 0 END,
    'top_screens_used', COALESCE(top_events, '[]'::jsonb),
    'top_friction_events', COALESCE(top_friction, '[]'::jsonb),
    'checkins_7d', checkins_7d,
    'checkin_submission_rate', CASE WHEN beta_clients > 0 THEN ROUND(100.0 * (checkins_7d::numeric / beta_clients), 1) ELSE 0 END,
    'workout_events_7d', workout_events_7d,
    'workout_completion_rate', CASE WHEN beta_clients > 0 THEN ROUND(100.0 * (workout_events_7d::numeric / beta_clients), 1) ELSE 0 END,
    'beta_coaches_total', beta_coaches,
    'beta_clients_total', beta_clients
  );
  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_beta_health_metrics() IS 'Admin-only beta health dashboard metrics. Caller must be in beta_feedback_admins.';
