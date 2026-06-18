-- ============================================================
-- FIX: Client access to message_threads and message_messages
-- ============================================================
-- PROBLEM: The original message_threads RLS only allowed
-- coach_id = auth.uid(). Clients could not read their own
-- thread or messages, causing infinite loading on the client
-- Messages screen.
--
-- ROOT CAUSE: message_threads.client_id is clients.id (a
-- roster UUID), NOT auth.uid(). The join must go through
-- public.clients.user_id to reach the auth identity.
--
-- PATTERN used by every other RLS policy in this codebase:
--   client_id IN (
--     SELECT id FROM public.clients WHERE user_id = auth.uid()
--   )
-- ============================================================

-- ── message_threads ─────────────────────────────────────────

-- Client: read their own thread
DROP POLICY IF EXISTS message_threads_select_client
  ON public.message_threads;
CREATE POLICY message_threads_select_client
  ON public.message_threads
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE user_id = auth.uid()
    )
  );

-- Client: update their thread (to write client_last_read_at)
DROP POLICY IF EXISTS message_threads_update_client
  ON public.message_threads;
CREATE POLICY message_threads_update_client
  ON public.message_threads
  FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE user_id = auth.uid()
    )
  );

-- ── message_messages ─────────────────────────────────────────

-- Client: read messages in their thread
DROP POLICY IF EXISTS message_messages_select_client
  ON public.message_messages;
CREATE POLICY message_messages_select_client
  ON public.message_messages
  FOR SELECT
  USING (
    thread_id IN (
      SELECT mt.id
      FROM public.message_threads mt
      JOIN public.clients c ON c.id = mt.client_id
      WHERE c.user_id = auth.uid()
    )
  );

-- Client: insert their own messages (sender_role must be 'client')
DROP POLICY IF EXISTS message_messages_insert_client
  ON public.message_messages;
CREATE POLICY message_messages_insert_client
  ON public.message_messages
  FOR INSERT
  WITH CHECK (
    sender_role = 'client'
    AND thread_id IN (
      SELECT mt.id
      FROM public.message_threads mt
      JOIN public.clients c ON c.id = mt.client_id
      WHERE c.user_id = auth.uid()
    )
  );

-- Client: update their own messages
-- (e.g. after voice note upload sets media_url + duration_ms)
DROP POLICY IF EXISTS message_messages_update_client
  ON public.message_messages;
CREATE POLICY message_messages_update_client
  ON public.message_messages
  FOR UPDATE
  USING (
    sender_role = 'client'
    AND thread_id IN (
      SELECT mt.id
      FROM public.message_threads mt
      JOIN public.clients c ON c.id = mt.client_id
      WHERE c.user_id = auth.uid()
    )
  );

-- ── storage.objects (message_media bucket) ──────────────────
-- The voice migration's storage SELECT policy correctly uses
-- OR client_id = auth.uid() but that is also wrong for the
-- same reason. Fix the storage SELECT policy too.

DROP POLICY IF EXISTS message_media_select ON storage.objects;
CREATE POLICY message_media_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'message_media'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT mt.id
      FROM public.message_threads mt
      WHERE
        -- Coach owns the thread
        mt.coach_id = auth.uid()
        OR
        -- Client is the client_id row (via user_id join)
        mt.client_id IN (
          SELECT id FROM public.clients
          WHERE user_id = auth.uid()
        )
    )
  );
