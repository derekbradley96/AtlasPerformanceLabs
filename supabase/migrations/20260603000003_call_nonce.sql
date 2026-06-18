ALTER TABLE public.checkin_call_requests
  ADD COLUMN IF NOT EXISTS call_nonce TEXT;

COMMENT ON COLUMN public.checkin_call_requests.call_nonce IS
  'Random nonce per call attempt. Used as Realtime channel
   suffix so each attempt has a completely isolated channel.
   Prevents stale events from previous calls interfering.';
