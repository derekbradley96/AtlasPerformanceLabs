-- SECURITY: get_personal_conversion_metrics is SECURITY DEFINER and trusted
-- its p_requested_coach_id argument with no authorization check, so any anon
-- caller could read ANY coach's funnel metrics (profile views, enquiries,
-- conversions) by supplying that coach's id. Now: require auth, and a coach
-- can only read their OWN metrics. Org-level views use
-- get_org_personal_conversion_metrics, which does its own membership check.
create or replace function public.get_personal_conversion_metrics(p_requested_coach_id uuid default null::uuid)
returns table(profile_views bigint, enquiries bigint, converted bigint, conversion_rate numeric)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_coach_id uuid;
begin
  if auth.uid() is null then
    return;
  end if;
  -- Ignore any supplied id that isn't the caller's own — no cross-coach reads.
  v_coach_id := auth.uid();
  if p_requested_coach_id is not null and p_requested_coach_id <> auth.uid() then
    return;
  end if;

  return query
  with agg as (
    select
      count(*) filter (where e.event_name = 'personal_viewed_coach_profile') as pv,
      count(*) filter (where e.event_name = 'personal_submitted_enquiry') as enq,
      count(*) filter (where e.event_name = 'personal_converted_to_client') as conv
    from public.platform_usage_events e
    where e.event_name in (
      'personal_viewed_coach_profile',
      'personal_submitted_enquiry',
      'personal_converted_to_client'
    )
    and (e.properties->>'coach_id')::uuid = v_coach_id
  )
  select
    a.pv::bigint,
    a.enq::bigint,
    a.conv::bigint,
    round(a.conv::numeric / nullif(a.pv, 0), 4)
  from agg a;
end;
$function$;

revoke all on function public.get_personal_conversion_metrics(uuid) from anon;
