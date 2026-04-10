-- Expose messaging tables to Supabase Realtime so chat UIs receive INSERT/UPDATE without polling.
-- Without this, postgres_changes subscriptions in the app never fire.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'message_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_messages;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'message_threads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_threads;
  END IF;
END $$;
