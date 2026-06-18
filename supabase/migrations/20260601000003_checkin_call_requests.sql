-- Call/consultation request system.
-- After reviewing a check-in, a coach can request a
-- phone or video call with the client.

CREATE TABLE IF NOT EXISTS public.checkin_call_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id UUID NOT NULL REFERENCES public.checkins(id)
    ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.profiles(id)
    ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id)
    ON DELETE CASCADE,
  call_type TEXT NOT NULL
    CHECK (call_type IN ('video','phone','message')),
  proposed_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  agenda TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending','accepted','declined',
      'rescheduled','completed','cancelled'
    )),
  client_message TEXT,
  reschedule_proposed_at TIMESTAMPTZ,
  room_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.checkin_call_requests IS
  'Call/video requests from coach to client after check-in review.
   room_url is a Whereby/Daily.co embed URL generated on demand.';

CREATE INDEX IF NOT EXISTS idx_call_requests_checkin
  ON public.checkin_call_requests(checkin_id);
CREATE INDEX IF NOT EXISTS idx_call_requests_coach
  ON public.checkin_call_requests(coach_id);
CREATE INDEX IF NOT EXISTS idx_call_requests_client
  ON public.checkin_call_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_call_requests_status
  ON public.checkin_call_requests(status)
  WHERE status IN ('pending','accepted');

ALTER TABLE public.checkin_call_requests
  ENABLE ROW LEVEL SECURITY;

-- Coach can read and create their own call requests
DROP POLICY IF EXISTS call_requests_coach_all
  ON public.checkin_call_requests;
CREATE POLICY call_requests_coach_all
  ON public.checkin_call_requests
  FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Client can read and update requests addressed to them
DROP POLICY IF EXISTS call_requests_client_read
  ON public.checkin_call_requests;
CREATE POLICY call_requests_client_read
  ON public.checkin_call_requests
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS call_requests_client_update
  ON public.checkin_call_requests;
CREATE POLICY call_requests_client_update
  ON public.checkin_call_requests
  FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE user_id = auth.uid()
    )
  );
