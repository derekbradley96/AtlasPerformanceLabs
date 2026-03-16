-- Personal-to-coach conversion: metrics from platform_usage_events for marketplace funnel.
-- Events: personal_opened_find_a_coach, personal_viewed_coach_profile, personal_submitted_enquiry, personal_converted_to_client.
-- coach_id is in properties->>'coach_id' for viewed/submitted/converted. RPCs use SECURITY DEFINER to read across users.

-- RPC: return conversion metrics for the current user (coach). Used on Referral Dashboard.
CREATE OR REPLACE FUNCTION public.get_personal_conversion_metrics(p_requested_coach_id uuid DEFAULT NULL)
RETURNS TABLE (
  profile_views bigint,
  enquiries bigint,
  converted bigint,
  conversion_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coach_id uuid;
BEGIN
  v_coach_id := COALESCE(p_requested_coach_id, auth.uid());
  IF v_coach_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH agg AS (
    SELECT
      COUNT(*) FILTER (WHERE e.event_name = 'personal_viewed_coach_profile') AS pv,
      COUNT(*) FILTER (WHERE e.event_name = 'personal_submitted_enquiry') AS enq,
      COUNT(*) FILTER (WHERE e.event_name = 'personal_converted_to_client') AS conv
    FROM public.platform_usage_events e
    WHERE e.event_name IN (
      'personal_viewed_coach_profile',
      'personal_submitted_enquiry',
      'personal_converted_to_client'
    )
    AND (e.properties->>'coach_id')::uuid = v_coach_id
  )
  SELECT
    a.pv::bigint,
    a.enq::bigint,
    a.conv::bigint,
    ROUND(a.conv::numeric / NULLIF(a.pv, 0), 4)
  FROM agg a;
END;
$$;

COMMENT ON FUNCTION public.get_personal_conversion_metrics(uuid) IS 'Returns Personal-to-Coach conversion counts and rate for a coach. Uses SECURITY DEFINER to read platform_usage_events.';

-- RPC: return org-wide personal conversion summary + by coach (for owner/admin). Optional comp vs transformation split.
CREATE OR REPLACE FUNCTION public.get_org_personal_conversion_metrics(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_is_org_admin boolean;
  v_global jsonb;
  v_by_coach jsonb;
  v_by_focus jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.organisation_members m
    WHERE m.organisation_id = p_org_id AND m.profile_id = v_caller_id
      AND m.is_active = true AND LOWER(m.role) IN ('owner', 'admin')
  ) INTO v_is_org_admin;

  IF NOT v_is_org_admin THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  -- Global funnel (all events; opened has no coach_id)
  SELECT jsonb_build_object(
    'opened_find_a_coach', (SELECT COUNT(*) FROM public.platform_usage_events WHERE event_name = 'personal_opened_find_a_coach'),
    'total_converted', (SELECT COUNT(*) FROM public.platform_usage_events WHERE event_name = 'personal_converted_to_client'),
    'conversion_rate', ROUND(
      (SELECT COUNT(*)::numeric FROM public.platform_usage_events WHERE event_name = 'personal_converted_to_client')
      / NULLIF((SELECT COUNT(*) FROM public.platform_usage_events WHERE event_name = 'personal_opened_find_a_coach'), 0),
      4
    )
  ) INTO v_global;

  -- By coach (only coaches in this org)
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  FROM (
    SELECT
      (e.properties->>'coach_id')::uuid AS coach_id,
      p.full_name AS coach_name,
      p.coach_focus,
      COUNT(*) FILTER (WHERE e.event_name = 'personal_viewed_coach_profile') AS profile_views,
      COUNT(*) FILTER (WHERE e.event_name = 'personal_submitted_enquiry') AS enquiries,
      COUNT(*) FILTER (WHERE e.event_name = 'personal_converted_to_client') AS converted,
      ROUND(
        COUNT(*) FILTER (WHERE e.event_name = 'personal_converted_to_client')::numeric
        / NULLIF(COUNT(*) FILTER (WHERE e.event_name = 'personal_viewed_coach_profile'), 0),
        4
      ) AS conversion_rate
    FROM public.platform_usage_events e
    JOIN public.profiles p ON p.id = (e.properties->>'coach_id')::uuid
    JOIN public.organisation_members om ON om.profile_id = p.id AND om.organisation_id = p_org_id AND om.is_active = true
    WHERE e.event_name IN ('personal_viewed_coach_profile', 'personal_submitted_enquiry', 'personal_converted_to_client')
      AND (e.properties->>'coach_id') IS NOT NULL
    GROUP BY (e.properties->>'coach_id')::uuid, p.full_name, p.coach_focus
    ORDER BY converted DESC NULLS LAST, profile_views DESC NULLS LAST
  ) t
  INTO v_by_coach;

  -- Comp vs transformation conversion split (by coach_focus of the coach who got the conversion)
  SELECT COALESCE(jsonb_object_agg(coalesce(coach_focus, 'unknown'), cnt), '{}'::jsonb)
  FROM (
    SELECT p.coach_focus, COUNT(*) AS cnt
    FROM public.platform_usage_events e
    JOIN public.profiles p ON p.id = (e.properties->>'coach_id')::uuid
    JOIN public.organisation_members om ON om.profile_id = p.id AND om.organisation_id = p_org_id AND om.is_active = true
    WHERE e.event_name = 'personal_converted_to_client' AND (e.properties->>'coach_id') IS NOT NULL
    GROUP BY p.coach_focus
  ) s
  INTO v_by_focus;

  RETURN jsonb_build_object(
    'global', v_global,
    'by_coach', v_by_coach,
    'by_focus', v_by_focus
  );
END;
$$;

COMMENT ON FUNCTION public.get_org_personal_conversion_metrics(uuid) IS 'Returns org-wide Personal-to-Coach conversion metrics for owners/admins: global funnel, by coach, comp vs transformation split.';
