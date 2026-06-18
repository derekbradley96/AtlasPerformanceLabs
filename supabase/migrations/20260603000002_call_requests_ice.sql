-- Store ICE candidates in DB as fallback for timing issues.
-- WebRTC ICE candidates are also broadcast via Realtime for
-- speed, but early candidates may be missed if the other
-- party subscribes late. DB storage ensures they're never lost.

ALTER TABLE public.checkin_call_requests
  ADD COLUMN IF NOT EXISTS caller_ice JSONB
    NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.checkin_call_requests
  ADD COLUMN IF NOT EXISTS callee_ice JSONB
    NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.checkin_call_requests.caller_ice IS
  'ICE candidates from the coach/caller. Stored in DB as
   fallback — also broadcast via Supabase Realtime.';
COMMENT ON COLUMN public.checkin_call_requests.callee_ice IS
  'ICE candidates from the client/callee.';
