-- WebRTC signalling data stored on the call request row.
-- The caller stores their SDP offer; the callee stores
-- their SDP answer. ICE candidates are exchanged via
-- Supabase Realtime broadcast, not stored in the DB.
-- The edge function (create-video-room) is no longer needed
-- for video — it can be retired or kept for phone logic.

ALTER TABLE public.checkin_call_requests
  ADD COLUMN IF NOT EXISTS sdp_offer TEXT;

ALTER TABLE public.checkin_call_requests
  ADD COLUMN IF NOT EXISTS sdp_answer TEXT;

ALTER TABLE public.checkin_call_requests
  ADD COLUMN IF NOT EXISTS caller_role TEXT
    CHECK (caller_role IN ('coach', 'client'));

COMMENT ON COLUMN public.checkin_call_requests.sdp_offer IS
  'WebRTC SDP offer from the call initiator (coach).';
COMMENT ON COLUMN public.checkin_call_requests.sdp_answer IS
  'WebRTC SDP answer from the callee (client).';
COMMENT ON COLUMN public.checkin_call_requests.caller_role IS
  'Who initiated the call — coach or client.';

-- Add realtime publication so both parties receive
-- postgres_changes when offer/answer are written.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'checkin_call_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.checkin_call_requests;
  END IF;
END $$;
