-- Messaging grants hotfix:
-- Ensure authenticated role has table privileges; RLS policies still enforce row access.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.message_threads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.message_messages TO authenticated;
