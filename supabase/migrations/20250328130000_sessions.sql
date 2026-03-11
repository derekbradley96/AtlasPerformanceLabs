-- In-person session scheduling for hybrid coaches.
-- coach_sessions: scheduled / completed / cancelled sessions linked to coach + client.

CREATE TABLE IF NOT EXISTS public.coach_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  session_type TEXT,
  session_date TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_sessions_coach_id ON public.coach_sessions(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_sessions_client_id ON public.coach_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_coach_sessions_session_date ON public.coach_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_coach_sessions_status ON public.coach_sessions(status);

COMMENT ON TABLE public.coach_sessions IS 'In-person (or hybrid) session scheduling: scheduled -> completed | cancelled.';

ALTER TABLE public.coach_sessions ENABLE ROW LEVEL SECURITY;

-- Coach: full access when coach_id = auth.uid() and client is owned by coach
DROP POLICY IF EXISTS coach_sessions_select_coach ON public.coach_sessions;
DROP POLICY IF EXISTS coach_sessions_insert_coach ON public.coach_sessions;
DROP POLICY IF EXISTS coach_sessions_update_coach ON public.coach_sessions;
DROP POLICY IF EXISTS coach_sessions_delete_coach ON public.coach_sessions;

CREATE POLICY coach_sessions_select_coach ON public.coach_sessions
  FOR SELECT USING (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = coach_sessions.client_id
        AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid())
    )
  );

CREATE POLICY coach_sessions_insert_coach ON public.coach_sessions
  FOR INSERT WITH CHECK (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = coach_sessions.client_id
        AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid())
    )
  );

CREATE POLICY coach_sessions_update_coach ON public.coach_sessions
  FOR UPDATE USING (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = coach_sessions.client_id
        AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid())
    )
  );

CREATE POLICY coach_sessions_delete_coach ON public.coach_sessions
  FOR DELETE USING (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = coach_sessions.client_id
        AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid())
    )
  );

-- Client: read-only for own sessions (client linked to auth user)
DROP POLICY IF EXISTS coach_sessions_select_client ON public.coach_sessions;

CREATE POLICY coach_sessions_select_client ON public.coach_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = coach_sessions.client_id AND c.user_id = auth.uid()
    )
  );
