-- Analytics coverage (audit #22):
-- 1. profiles.analytics_opt_out — the privacy policy promises "opt out of
--    analytics tracking"; this is the flag the client SDK and stripe-webhook
--    check before writing platform_usage_events.
-- 2. signup_completed event via AFTER INSERT trigger on profiles — the top of
--    the signup funnel was invisible (no client path fires an event before
--    the user is authenticated). The trigger catches every signup regardless
--    of client flow or email-confirmation timing.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS analytics_opt_out BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.track_signup_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.platform_usage_events (event_name, user_id, properties)
  VALUES (
    'signup_completed',
    NEW.id,
    jsonb_build_object('role', NEW.role, 'source', 'db_trigger')
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Analytics must never block account creation.
    RAISE WARNING '[track_signup_completed] failed for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_signup_completed ON public.profiles;
CREATE TRIGGER trg_track_signup_completed
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.track_signup_completed();
