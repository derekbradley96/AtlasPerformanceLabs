ALTER TABLE public.checkin_call_requests
  ADD COLUMN IF NOT EXISTS host_room_url TEXT;

COMMENT ON COLUMN public.checkin_call_requests.host_room_url IS
  'Whereby host URL for the coach. Gives host controls.
   Client uses room_url (standard participant URL).';
