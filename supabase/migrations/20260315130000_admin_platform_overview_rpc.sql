-- Admin platform overview RPC: platform counts, operational health, growth metrics.
-- Caller must have profiles.is_admin = true. Used by Atlas admin dashboard.

CREATE OR REPLACE FUNCTION public.get_admin_platform_overview()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  total_coaches int;
  total_clients int;
  total_personal int;
  active_subscriptions int;
  total_organisations int;
  checkins_pending int;
  overdue_subscriptions int;
  failed_payments int;
  new_enquiries int;
  signups_7d int;
  coaches_30d int;
  referral_conversions int;
BEGIN
  uid := auth.uid();
  IF uid IS NULL OR NOT (SELECT COALESCE(is_admin, false) FROM public.profiles WHERE id = uid) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- Platform overview
  SELECT COUNT(*)::int INTO total_coaches FROM public.profiles
  WHERE LOWER(COALESCE(role, '')) IN ('coach', 'trainer');

  SELECT COUNT(*)::int INTO total_clients FROM public.profiles
  WHERE LOWER(COALESCE(role, '')) = 'client';

  SELECT COUNT(*)::int INTO total_personal FROM public.profiles
  WHERE LOWER(COALESCE(role, '')) IN ('solo', 'personal');

  SELECT COUNT(*)::int INTO active_subscriptions FROM public.client_subscriptions
  WHERE status = 'active' OR (status IS NULL AND next_billing_date >= current_date);

  SELECT COUNT(*)::int INTO total_organisations FROM public.organisations;

  -- Operational health
  SELECT COUNT(*)::int INTO checkins_pending FROM public.checkins
  WHERE submitted_at IS NOT NULL AND reviewed_at IS NULL;

  SELECT COUNT(*)::int INTO overdue_subscriptions FROM public.client_subscriptions
  WHERE next_billing_date IS NOT NULL AND next_billing_date < current_date
    AND (status IS NULL OR status IN ('active', 'overdue'));

  SELECT COUNT(*)::int INTO failed_payments FROM public.client_payments
  WHERE status = 'failed';

  SELECT COUNT(*)::int INTO new_enquiries FROM public.coach_public_enquiries
  WHERE status = 'new';

  -- Growth metrics (last 7d signups = profiles or auth; last 30d coaches; referral signups)
  SELECT COUNT(*)::int INTO signups_7d FROM auth.users
  WHERE created_at >= (now() - interval '7 days');

  SELECT COUNT(*)::int INTO coaches_30d
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE LOWER(COALESCE(p.role, '')) IN ('coach', 'trainer')
    AND u.created_at >= (now() - interval '30 days');

  SELECT COUNT(*)::int INTO referral_conversions
  FROM public.coach_referral_events
  WHERE event_type = 'signup_completed'
    AND created_at >= (now() - interval '30 days');

  RETURN jsonb_build_object(
    'platform', jsonb_build_object(
      'total_coaches', total_coaches,
      'total_clients', total_clients,
      'total_personal', total_personal,
      'active_subscriptions', active_subscriptions,
      'total_organisations', total_organisations
    ),
    'operational', jsonb_build_object(
      'checkins_pending', checkins_pending,
      'overdue_subscriptions', overdue_subscriptions,
      'failed_payments', failed_payments,
      'new_enquiries', new_enquiries
    ),
    'growth', jsonb_build_object(
      'signups_7d', signups_7d,
      'coaches_30d', coaches_30d,
      'referral_conversions', referral_conversions
    )
  );
END;
$$;

COMMENT ON FUNCTION public.get_admin_platform_overview() IS 'Admin-only: platform overview, operational health, and growth metrics. Requires profiles.is_admin = true.';
