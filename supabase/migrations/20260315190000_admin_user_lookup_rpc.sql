-- Admin user lookup: full detail for a profile (org, clients, subscriptions, recent activity).
-- Caller must have profiles.is_admin = true.

CREATE OR REPLACE FUNCTION public.get_admin_user_detail(p_profile_id uuid)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  pro jsonb;
  org jsonb;
  clients_arr jsonb;
  subs_arr jsonb;
  activity_arr jsonb;
  client_ids uuid[];
BEGIN
  uid := auth.uid();
  IF uid IS NULL OR NOT (SELECT COALESCE(is_admin, false) FROM public.profiles WHERE id = uid) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;
  IF p_profile_id IS NULL THEN
    RETURN jsonb_build_object('error', 'missing_profile_id');
  END IF;

  -- Profile + email
  SELECT jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'role', p.role,
    'coach_focus', p.coach_focus,
    'organisation_id', p.organisation_id,
    'onboarding_complete', p.onboarding_complete,
    'email', u.email,
    'created_at', u.created_at
  ) INTO pro
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE p.id = p_profile_id;

  IF pro IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  -- Organisation
  SELECT jsonb_build_object('id', o.id, 'name', o.name) INTO org
  FROM public.organisations o
  WHERE o.id = (pro->>'organisation_id')::uuid;

  -- Clients: as coach (coach_id or trainer_id = profile) or as client (user_id = profile)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'name', COALESCE(c.name, ''),
    'coach_id', c.coach_id,
    'user_id', c.user_id,
    'organisation_id', c.organisation_id
  )), '[]'::jsonb) INTO clients_arr
  FROM public.clients c
  WHERE c.coach_id = p_profile_id OR c.trainer_id = p_profile_id OR c.user_id = p_profile_id;

  -- Client IDs for subscriptions and activity (clients where they are coach or the client)
  SELECT ARRAY_AGG(DISTINCT c.id) INTO client_ids
  FROM public.clients c
  WHERE c.coach_id = p_profile_id OR c.trainer_id = p_profile_id OR c.user_id = p_profile_id;

  -- Subscriptions for those clients
  IF client_ids IS NOT NULL AND array_length(client_ids, 1) > 0 THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'client_id', s.client_id,
      'plan_name', s.plan_name,
      'status', s.status,
      'price', s.price,
      'next_billing_date', s.next_billing_date
    )), '[]'::jsonb) INTO subs_arr
    FROM public.client_subscriptions s
    WHERE s.client_id = ANY(client_ids);
  ELSE
    subs_arr := '[]'::jsonb;
  END IF;

  -- Recent activity: last 10 checkins for those clients
  IF client_ids IS NOT NULL AND array_length(client_ids, 1) > 0 THEN
    SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) INTO activity_arr
    FROM (
      SELECT jsonb_build_object(
        'id', ch.id,
        'client_id', ch.client_id,
        'submitted_at', ch.submitted_at,
        'reviewed_at', ch.reviewed_at
      ) AS row
      FROM public.checkins ch
      WHERE ch.client_id = ANY(client_ids)
      ORDER BY ch.submitted_at DESC NULLS LAST
      LIMIT 10
    ) sub;
  ELSE
    activity_arr := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'profile', pro,
    'organisation', org,
    'clients', COALESCE(clients_arr, '[]'::jsonb),
    'subscriptions', COALESCE(subs_arr, '[]'::jsonb),
    'recent_activity', COALESCE(activity_arr, '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.get_admin_user_detail(uuid) IS 'Admin-only: full user detail (profile, org, clients, subscriptions, recent checkins). Requires profiles.is_admin = true.';
