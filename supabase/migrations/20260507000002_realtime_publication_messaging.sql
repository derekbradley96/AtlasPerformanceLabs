-- Enable Supabase Realtime for messaging tables.
-- Without this, postgres_changes subscriptions on
-- message_messages and message_threads receive no events,
-- even when the subscription code is correctly written.

-- Add message_messages to the realtime publication
-- so INSERT and UPDATE events fire to subscribers.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'message_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.message_messages';
  END IF;
END $$;

-- Add message_threads to the realtime publication
-- so UPDATE events fire when read cursors are updated
-- (coach_last_read_at, client_last_read_at, updated_at).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'message_threads'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.message_threads';
  END IF;
END $$;

-- Verify (comment — run manually to confirm):
-- SELECT schemaname, tablename
-- FROM pg_publication_tables
-- WHERE pubname = 'supabase_realtime'
-- AND tablename IN ('message_messages', 'message_threads');
