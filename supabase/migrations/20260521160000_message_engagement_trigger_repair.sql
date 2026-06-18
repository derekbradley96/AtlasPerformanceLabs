-- Repair message_sent engagement trigger after meta -> metadata rename.
-- When this function is stale, message INSERT succeeds in RLS but rolls back in the trigger.

CREATE OR REPLACE FUNCTION public.record_message_engagement_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
  v_coach_id UUID;
BEGIN
  SELECT mt.client_id, mt.coach_id INTO v_client_id, v_coach_id
  FROM public.message_threads mt
  WHERE mt.id = NEW.thread_id;
  IF v_client_id IS NOT NULL THEN
    INSERT INTO public.client_engagement_events (client_id, coach_id, event_type, metadata)
    VALUES (
      v_client_id,
      v_coach_id,
      'message_sent',
      jsonb_build_object('thread_id', NEW.thread_id, 'message_id', NEW.id)
    );
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block messaging if engagement logging fails (schema drift, RLS, etc.)
    RETURN NEW;
END;
$$;
