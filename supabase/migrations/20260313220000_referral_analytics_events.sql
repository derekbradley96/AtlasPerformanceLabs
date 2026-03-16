-- Referral and results analytics: extend coach_referral_events event types and add summary view.
-- Event types added: public_profile_viewed, result_story_viewed, enquiry_submitted, referral_link_copied, referral_link_shared.

ALTER TABLE public.coach_referral_events
  DROP CONSTRAINT IF EXISTS coach_referral_events_event_type_check;

ALTER TABLE public.coach_referral_events
  ADD CONSTRAINT coach_referral_events_event_type_check
  CHECK (event_type IN (
    'link_opened',
    'profile_viewed',
    'enquiry_started',
    'enquiry_submitted',
    'signup_completed',
    'public_profile_viewed',
    'result_story_viewed',
    'referral_link_copied',
    'referral_link_shared'
  ));

COMMENT ON TABLE public.coach_referral_events IS 'Referral funnel events: profile/view/story views, enquiry started/submitted, link copied/shared, signup.';

-- Optional: view for per-coach referral analytics (profile views, story views, enquiries, conversion).
-- Use for coach dashboard and for org/platform "top viewed coaches".
CREATE OR REPLACE VIEW public.v_referral_analytics_by_coach
WITH (security_invoker = true)
AS
SELECT
  coach_id,
  COUNT(*) FILTER (WHERE event_type IN ('public_profile_viewed', 'profile_viewed')) AS profile_views,
  COUNT(*) FILTER (WHERE event_type = 'result_story_viewed') AS result_story_views,
  COUNT(*) FILTER (WHERE event_type = 'enquiry_started') AS enquiry_starts,
  COUNT(*) FILTER (WHERE event_type = 'enquiry_submitted') AS enquiry_submits,
  COUNT(*) FILTER (WHERE event_type = 'referral_link_copied') AS link_copied_count,
  COUNT(*) FILTER (WHERE event_type = 'referral_link_shared') AS link_shared_count,
  COUNT(*) FILTER (WHERE event_type = 'signup_completed') AS signups_completed,
  ROUND(
    (COUNT(*) FILTER (WHERE event_type = 'enquiry_submitted')::numeric)
    / NULLIF(COUNT(*) FILTER (WHERE event_type IN ('public_profile_viewed', 'profile_viewed')), 0),
    4
  ) AS conversion_rate
FROM public.coach_referral_events
GROUP BY coach_id;

COMMENT ON VIEW public.v_referral_analytics_by_coach IS 'Per-coach referral funnel counts and conversion (enquiry_submits / profile_views).';
