-- Add 'ringing' status so the app knows when a call
-- is actively incoming (as opposed to just requested).
-- Coach clicks Join -> status = 'ringing' -> client
-- device shows incoming call banner.

ALTER TABLE public.checkin_call_requests
  DROP CONSTRAINT IF EXISTS checkin_call_requests_status_check;

ALTER TABLE public.checkin_call_requests
  ADD CONSTRAINT checkin_call_requests_status_check
  CHECK (status IN (
    'pending',    -- coach sent request, client not yet responded
    'accepted',   -- client said yes to the time/date
    'ringing',    -- coach has clicked Join — call is live NOW
    'in_progress',-- both parties connected
    'declined',   -- client rejected the incoming call
    'completed',  -- call ended normally
    'rescheduled',-- client asked for different time
    'cancelled'   -- coach cancelled before client answered
  ));

-- Also add caller_name so the incoming banner can show
-- the coach's name without a second DB query
ALTER TABLE public.checkin_call_requests
  ADD COLUMN IF NOT EXISTS caller_name TEXT;
ALTER TABLE public.checkin_call_requests
  ADD COLUMN IF NOT EXISTS caller_avatar TEXT;

COMMENT ON COLUMN public.checkin_call_requests.caller_name IS
  'Display name of the person who clicked Join — for the incoming call banner.';
