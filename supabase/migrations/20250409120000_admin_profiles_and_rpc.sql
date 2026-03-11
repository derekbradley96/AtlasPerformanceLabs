-- Admin flag on profiles and admin-only RPCs for platform operations.
-- Set is_admin = true for your account (e.g. derekbradley96@gmail.com) via Supabase dashboard or:
--   UPDATE public.profiles SET is_admin = true WHERE id = (SELECT id FROM auth.users WHERE LOWER(email) = 'derekbradley96@gmail.com' LIMIT 1);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin) WHERE is_admin = true;

COMMENT ON COLUMN public.profiles.is_admin IS 'Platform admin: can access /admin and admin RPCs.';

-- Backfill: set is_admin for derekbradley96@gmail.com (run as superuser; auth.users is in auth schema)
DO $$
BEGIN
  UPDATE public.profiles
  SET is_admin = true
  WHERE id IN (SELECT id FROM auth.users WHERE LOWER(email) = 'derekbradley96@gmail.com')
  AND (is_admin IS NULL OR is_admin = false);
END $$;

-- RPC: admin dashboard counts. Caller must have profiles.is_admin = true.
CREATE OR REPLACE FUNCTION public.get_admin_dashboard()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  total_users int;
  coaches_count int;
  clients_count int;
  personal_count int;
  dau int;
  messages_today bigint;
  workouts_today bigint;
  checkins_today bigint;
  today_start timestamptz;
BEGIN
  uid := auth.uid();
  IF uid IS NULL OR NOT (SELECT COALESCE(is_admin, false) FROM public.profiles WHERE id = uid) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  today_start := date_trunc('day', now())::timestamptz;

  SELECT COUNT(*)::int INTO total_users FROM public.profiles;

  SELECT COUNT(*)::int INTO coaches_count FROM public.profiles
  WHERE LOWER(COALESCE(role, '')) IN ('coach', 'trainer');

  SELECT COUNT(*)::int INTO clients_count FROM public.profiles
  WHERE LOWER(COALESCE(role, '')) = 'client';

  SELECT COUNT(*)::int INTO personal_count FROM public.profiles
  WHERE LOWER(COALESCE(role, '')) IN ('solo', 'personal');

  SELECT COUNT(DISTINCT user_id)::int INTO dau FROM public.platform_usage_events
  WHERE created_at >= today_start;

  SELECT COUNT(*)::bigint INTO messages_today FROM public.platform_usage_events
  WHERE event_name = 'message_sent' AND created_at >= today_start;

  SELECT COUNT(*)::bigint INTO workouts_today FROM public.platform_usage_events
  WHERE event_name = 'workout_logged' AND created_at >= today_start;

  SELECT COUNT(*)::bigint INTO checkins_today FROM public.checkins
  WHERE submitted_at >= today_start;

  RETURN jsonb_build_object(
    'total_users', total_users,
    'coaches', coaches_count,
    'clients', clients_count,
    'personal', personal_count,
    'daily_active_users', dau,
    'messages_sent_today', messages_today,
    'workouts_logged_today', workouts_today,
    'checkins_submitted_today', checkins_today
  );
END;
$$;

-- RPC: admin users list with optional search. Returns id, email, role, coach_focus, created_at.
CREATE OR REPLACE FUNCTION public.get_admin_users(p_search TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  result jsonb;
  search_trim text;
BEGIN
  uid := auth.uid();
  IF uid IS NULL OR NOT (SELECT COALESCE(is_admin, false) FROM public.profiles WHERE id = uid) THEN
    RETURN jsonb_build_object('error', 'unauthorized', 'rows', '[]'::jsonb);
  END IF;

  search_trim := NULLIF(TRIM(LOWER(COALESCE(p_search, ''))), '');

  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) INTO result
  FROM (
    SELECT jsonb_build_object(
      'id', p.id,
      'email', u.email,
      'display_name', p.display_name,
      'role', p.role,
      'coach_focus', p.coach_focus,
      'created_at', u.created_at
    ) AS row
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE search_trim IS NULL
       OR LOWER(COALESCE(u.email, '')) LIKE '%' || search_trim || '%'
       OR LOWER(COALESCE(p.display_name, '')) LIKE '%' || search_trim || '%'
       OR LOWER(COALESCE(p.role, '')) LIKE '%' || search_trim || '%'
    ORDER BY u.created_at DESC NULLS LAST
    LIMIT 500
  ) sub;

  RETURN jsonb_build_object('rows', COALESCE(result, '[]'::jsonb));
END;
$$;

-- RPC: admin coaches list with client count and revenue placeholder.
CREATE OR REPLACE FUNCTION public.get_admin_coaches()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  result jsonb;
BEGIN
  uid := auth.uid();
  IF uid IS NULL OR NOT (SELECT COALESCE(is_admin, false) FROM public.profiles WHERE id = uid) THEN
    RETURN jsonb_build_object('error', 'unauthorized', 'rows', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) INTO result
  FROM (
    SELECT jsonb_build_object(
      'id', p.id,
      'display_name', p.display_name,
      'email', u.email,
      'coach_focus', p.coach_focus,
      'clients_count', COALESCE(c.cnt, 0),
      'revenue', null
    ) AS row
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    LEFT JOIN (
      SELECT COALESCE(clients.coach_id, clients.trainer_id) AS coach_id, COUNT(*)::int AS cnt
      FROM public.clients
      WHERE clients.coach_id IS NOT NULL OR clients.trainer_id IS NOT NULL
      GROUP BY COALESCE(clients.coach_id, clients.trainer_id)
    ) c ON c.coach_id = p.id
    WHERE LOWER(COALESCE(p.role, '')) IN ('coach', 'trainer')
    ORDER BY COALESCE(c.cnt, 0) DESC, p.display_name
    LIMIT 500
  ) sub;

  RETURN jsonb_build_object('rows', COALESCE(result, '[]'::jsonb));
END;
$$;

-- RPC: admin metrics (platform_usage_events summaries).
CREATE OR REPLACE FUNCTION public.get_admin_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  event_counts jsonb;
  recent jsonb;
BEGIN
  uid := auth.uid();
  IF uid IS NULL OR NOT (SELECT COALESCE(is_admin, false) FROM public.profiles WHERE id = uid) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('event_name', event_name, 'count', cnt)), '[]'::jsonb) INTO event_counts
  FROM (
    SELECT event_name, COUNT(*)::bigint AS cnt
    FROM public.platform_usage_events
    GROUP BY event_name
    ORDER BY cnt DESC
    LIMIT 50
  ) sub;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('event_name', event_name, 'created_at', created_at, 'user_id', user_id)), '[]'::jsonb) INTO recent
  FROM (
    SELECT event_name, created_at, user_id
    FROM public.platform_usage_events
    ORDER BY created_at DESC
    LIMIT 100
  ) sub2;

  RETURN jsonb_build_object(
    'by_event', COALESCE(event_counts, '[]'::jsonb),
    'recent', COALESCE(recent, '[]'::jsonb)
  );
END;
$$;

-- Allow admins (profiles.is_admin) to SELECT and UPDATE beta_feedback
DROP POLICY IF EXISTS beta_feedback_select_is_admin ON public.beta_feedback;
CREATE POLICY beta_feedback_select_is_admin ON public.beta_feedback
  FOR SELECT USING ((SELECT COALESCE(is_admin, false) FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS beta_feedback_update_is_admin ON public.beta_feedback;
CREATE POLICY beta_feedback_update_is_admin ON public.beta_feedback
  FOR UPDATE USING ((SELECT COALESCE(is_admin, false) FROM public.profiles WHERE id = auth.uid()));

-- Allow admins to SELECT all profiles (for admin users list if needed client-side)
-- Skipped: we use get_admin_users RPC. If you need client-side profile list, add:
-- CREATE POLICY profiles_select_admin ON profiles FOR SELECT USING ((SELECT COALESCE(is_admin, false) FROM profiles WHERE id = auth.uid()));

COMMENT ON FUNCTION public.get_admin_dashboard() IS 'Admin-only dashboard counts. Requires profiles.is_admin = true.';
COMMENT ON FUNCTION public.get_admin_users(TEXT) IS 'Admin-only user list with optional search.';
COMMENT ON FUNCTION public.get_admin_coaches() IS 'Admin-only coaches list with client count.';
COMMENT ON FUNCTION public.get_admin_metrics() IS 'Admin-only platform_usage_events summaries.';
