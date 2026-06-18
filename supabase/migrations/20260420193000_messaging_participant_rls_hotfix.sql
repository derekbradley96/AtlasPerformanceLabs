-- Messaging RLS hotfix:
-- - Rebuild message_threads/message_messages policies explicitly for authenticated users.
-- - Keep participant constraints strict (coach or linked client only).
-- - Ensure client sends as sender_role='client' and coach sends as sender_role='coach'.

ALTER TABLE IF EXISTS public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.message_messages ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol_rec RECORD;
BEGIN
  FOR pol_rec IN
    SELECT pol.polname, c.relname
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('message_threads', 'message_messages')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_rec.polname, pol_rec.relname);
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- message_threads
-- ---------------------------------------------------------------------------
CREATE POLICY message_threads_select ON public.message_threads
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      coach_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.clients c
        WHERE c.id = message_threads.client_id
          AND c.user_id = auth.uid()
      )
    )
  );

CREATE POLICY message_threads_insert ON public.message_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    deleted_at IS NULL
    AND coach_id = auth.uid()
  );

CREATE POLICY message_threads_update ON public.message_threads
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      coach_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.clients c
        WHERE c.id = message_threads.client_id
          AND c.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    deleted_at IS NULL
    AND (
      coach_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.clients c
        WHERE c.id = message_threads.client_id
          AND c.user_id = auth.uid()
      )
    )
  );

CREATE POLICY message_threads_delete ON public.message_threads
  FOR DELETE TO authenticated
  USING (coach_id = auth.uid());

-- ---------------------------------------------------------------------------
-- message_messages
-- ---------------------------------------------------------------------------
CREATE POLICY message_messages_select ON public.message_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.message_threads mt
      WHERE mt.id = message_messages.thread_id
        AND mt.deleted_at IS NULL
        AND (
          mt.coach_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.clients c
            WHERE c.id = mt.client_id
              AND c.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY message_messages_insert ON public.message_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      message_messages.sender_role::text = 'coach'
      AND EXISTS (
        SELECT 1
        FROM public.message_threads mt
        WHERE mt.id = message_messages.thread_id
          AND mt.deleted_at IS NULL
          AND mt.coach_id = auth.uid()
      )
    )
    OR
    (
      message_messages.sender_role::text = 'client'
      AND EXISTS (
        SELECT 1
        FROM public.message_threads mt
        JOIN public.clients c ON c.id = mt.client_id
        WHERE mt.id = message_messages.thread_id
          AND mt.deleted_at IS NULL
          AND c.user_id = auth.uid()
      )
    )
  );

-- Keep update constrained to the original sender participant branch.
-- Needed for media rows that are inserted first, then updated with media_url/duration_ms.
CREATE POLICY message_messages_update ON public.message_messages
  FOR UPDATE TO authenticated
  USING (
    (
      message_messages.sender_role::text = 'coach'
      AND EXISTS (
        SELECT 1
        FROM public.message_threads mt
        WHERE mt.id = message_messages.thread_id
          AND mt.deleted_at IS NULL
          AND mt.coach_id = auth.uid()
      )
    )
    OR
    (
      message_messages.sender_role::text = 'client'
      AND EXISTS (
        SELECT 1
        FROM public.message_threads mt
        JOIN public.clients c ON c.id = mt.client_id
        WHERE mt.id = message_messages.thread_id
          AND mt.deleted_at IS NULL
          AND c.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    (
      message_messages.sender_role::text = 'coach'
      AND EXISTS (
        SELECT 1
        FROM public.message_threads mt
        WHERE mt.id = message_messages.thread_id
          AND mt.deleted_at IS NULL
          AND mt.coach_id = auth.uid()
      )
    )
    OR
    (
      message_messages.sender_role::text = 'client'
      AND EXISTS (
        SELECT 1
        FROM public.message_threads mt
        JOIN public.clients c ON c.id = mt.client_id
        WHERE mt.id = message_messages.thread_id
          AND mt.deleted_at IS NULL
          AND c.user_id = auth.uid()
      )
    )
  );

CREATE POLICY message_messages_delete ON public.message_messages
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.message_threads mt
      WHERE mt.id = message_messages.thread_id
        AND mt.coach_id = auth.uid()
    )
  );
