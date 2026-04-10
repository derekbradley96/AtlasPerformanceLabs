-- Coach ↔ client messaging: participant RLS (clients can read/write their thread), read receipts for unread counts.
-- message_threads.client_id references public.clients.id (roster), not auth.uid().

ALTER TABLE public.message_threads
  ADD COLUMN IF NOT EXISTS coach_last_read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_last_read_at TIMESTAMPTZ;

COMMENT ON COLUMN public.message_threads.coach_last_read_at IS 'Coach last viewed thread; client-originated messages after this count as unread for coach UI.';
COMMENT ON COLUMN public.message_threads.client_last_read_at IS 'Client last viewed thread; coach-originated messages after this count as unread for client UI.';

-- Existing rows: avoid flooding unread badges on deploy — treat history as read at last thread activity.
UPDATE public.message_threads
SET
  coach_last_read_at = COALESCE(coach_last_read_at, updated_at),
  client_last_read_at = COALESCE(client_last_read_at, updated_at)
WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- message_threads
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS message_threads_select ON public.message_threads;
CREATE POLICY message_threads_select ON public.message_threads
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      coach_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = client_id AND c.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS message_threads_insert ON public.message_threads;
CREATE POLICY message_threads_insert ON public.message_threads
  FOR INSERT WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS message_threads_update ON public.message_threads;
CREATE POLICY message_threads_update ON public.message_threads
  FOR UPDATE USING (
    coach_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS message_threads_delete ON public.message_threads;
CREATE POLICY message_threads_delete ON public.message_threads
  FOR DELETE USING (coach_id = auth.uid());

-- ---------------------------------------------------------------------------
-- message_messages
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS message_messages_select ON public.message_messages;
CREATE POLICY message_messages_select ON public.message_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.message_threads mt
      WHERE mt.id = thread_id
        AND mt.deleted_at IS NULL
        AND (
          mt.coach_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = mt.client_id AND c.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS message_messages_insert ON public.message_messages;
-- Cast sender_role for WITH CHECK: some Postgres/RLS paths type NEW row columns as text vs enum,
-- which errors with: operator does not exist: text = message_sender_role (SQLSTATE 42883).
CREATE POLICY message_messages_insert ON public.message_messages
  FOR INSERT WITH CHECK (
    (
      sender_role::text = 'coach'
      AND EXISTS (
        SELECT 1 FROM public.message_threads mt
        WHERE mt.id = thread_id AND mt.coach_id = auth.uid()
      )
    )
    OR (
      sender_role::text = 'client'
      AND EXISTS (
        SELECT 1 FROM public.message_threads mt
        JOIN public.clients c ON c.id = mt.client_id
        WHERE mt.id = thread_id AND c.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS message_messages_update ON public.message_messages;
CREATE POLICY message_messages_update ON public.message_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.message_threads mt
      WHERE mt.id = thread_id
        AND mt.deleted_at IS NULL
        AND (
          mt.coach_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = mt.client_id AND c.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS message_messages_delete ON public.message_messages;
CREATE POLICY message_messages_delete ON public.message_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.message_threads mt
      WHERE mt.id = thread_id AND mt.coach_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- message_media storage: thread folder = thread UUID; participants may read; coach or client may upload for their thread
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS message_media_select ON storage.objects;
CREATE POLICY message_media_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'message_media'
    AND EXISTS (
      SELECT 1 FROM public.message_threads mt
      WHERE mt.id = (storage.foldername(name))[1]::uuid
        AND mt.deleted_at IS NULL
        AND (
          mt.coach_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = mt.client_id AND c.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS message_media_insert ON storage.objects;
CREATE POLICY message_media_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'message_media'
    AND EXISTS (
      SELECT 1 FROM public.message_threads mt
      WHERE mt.id = (storage.foldername(name))[1]::uuid
        AND mt.deleted_at IS NULL
        AND (
          mt.coach_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = mt.client_id AND c.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS message_media_update ON storage.objects;
CREATE POLICY message_media_update ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'message_media'
    AND EXISTS (
      SELECT 1 FROM public.message_threads mt
      WHERE mt.id = (storage.foldername(name))[1]::uuid
        AND mt.deleted_at IS NULL
        AND (
          mt.coach_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = mt.client_id AND c.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS message_media_delete ON storage.objects;
CREATE POLICY message_media_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'message_media'
    AND EXISTS (
      SELECT 1 FROM public.message_threads mt
      WHERE mt.id = (storage.foldername(name))[1]::uuid
        AND mt.deleted_at IS NULL
        AND (
          mt.coach_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = mt.client_id AND c.user_id = auth.uid()
          )
        )
    )
  );
