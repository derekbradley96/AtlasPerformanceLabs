-- Community should behave like a true group chat.
-- Disable coach_led top-level posting restriction for clients.

CREATE OR REPLACE FUNCTION public.atlas_group_messages_enforce_coach_led()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN NEW;
END;
$$;
