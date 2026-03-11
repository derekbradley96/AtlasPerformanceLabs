-- Messaging: threads (coach + client) and messages.
-- RLS: coach can only access their own threads and messages.

CREATE TABLE IF NOT EXISTS public.message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL,
  client_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(coach_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_message_threads_coach_id ON public.message_threads(coach_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_client_id ON public.message_threads(client_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_updated_at ON public.message_threads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_threads_deleted_at ON public.message_threads(deleted_at) WHERE deleted_at IS NULL;

CREATE TYPE message_sender_role AS ENUM ('coach', 'client');

CREATE TABLE IF NOT EXISTS public.message_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  sender_role message_sender_role NOT NULL DEFAULT 'coach',
  message_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_messages_thread_id ON public.message_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_message_messages_created_at ON public.message_messages(created_at ASC);

ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS message_threads_select ON public.message_threads;
CREATE POLICY message_threads_select ON public.message_threads
  FOR SELECT USING (coach_id = auth.uid());

DROP POLICY IF EXISTS message_threads_insert ON public.message_threads;
CREATE POLICY message_threads_insert ON public.message_threads
  FOR INSERT WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS message_threads_update ON public.message_threads;
CREATE POLICY message_threads_update ON public.message_threads
  FOR UPDATE USING (coach_id = auth.uid());

DROP POLICY IF EXISTS message_threads_delete ON public.message_threads;
CREATE POLICY message_threads_delete ON public.message_threads
  FOR DELETE USING (coach_id = auth.uid());

DROP POLICY IF EXISTS message_messages_select ON public.message_messages;
CREATE POLICY message_messages_select ON public.message_messages
  FOR SELECT USING (
    thread_id IN (SELECT id FROM public.message_threads WHERE coach_id = auth.uid())
  );

DROP POLICY IF EXISTS message_messages_insert ON public.message_messages;
CREATE POLICY message_messages_insert ON public.message_messages
  FOR INSERT WITH CHECK (
    thread_id IN (SELECT id FROM public.message_threads WHERE coach_id = auth.uid())
  );

DROP POLICY IF EXISTS message_messages_delete ON public.message_messages;
CREATE POLICY message_messages_delete ON public.message_messages
  FOR DELETE USING (
    thread_id IN (SELECT id FROM public.message_threads WHERE coach_id = auth.uid())
  );
