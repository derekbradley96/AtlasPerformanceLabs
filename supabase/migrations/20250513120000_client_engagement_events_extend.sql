-- Extend client_engagement_events for coaching intelligence: coach_id, metadata, expanded event_type.
-- Preserves existing triggers; updates them to use metadata. Does not drop table or RLS.

-- 1) Add coach_id if not present
ALTER TABLE public.client_engagement_events
  ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_engagement_events_coach_id
  ON public.client_engagement_events(coach_id) WHERE coach_id IS NOT NULL;

-- 2) Standardise on metadata (existing column may be "meta")
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'client_engagement_events' AND column_name = 'meta'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'client_engagement_events' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.client_engagement_events RENAME COLUMN meta TO metadata;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'client_engagement_events' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.client_engagement_events ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Ensure metadata exists and has default (idempotent)
ALTER TABLE public.client_engagement_events
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3) Expand event_type allowed values (migrate existing, then drop old check, add new)
UPDATE public.client_engagement_events SET event_type = 'progress_photo_uploaded' WHERE event_type = 'photo_uploaded';
UPDATE public.client_engagement_events SET event_type = 'checkin_submitted' WHERE event_type NOT IN (
  'workout_logged', 'checkin_submitted', 'message_sent', 'progress_photo_uploaded', 'app_opened', 'program_completed', 'pose_check_submitted'
);

ALTER TABLE public.client_engagement_events
  DROP CONSTRAINT IF EXISTS client_engagement_events_event_type_check;

ALTER TABLE public.client_engagement_events
  ADD CONSTRAINT client_engagement_events_event_type_check
  CHECK (event_type IN (
    'workout_logged',
    'checkin_submitted',
    'message_sent',
    'progress_photo_uploaded',
    'app_opened',
    'program_completed',
    'pose_check_submitted'
  ));

-- 4) Update trigger functions to write metadata and set coach_id
CREATE OR REPLACE FUNCTION public.record_checkin_engagement_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coach_id UUID;
BEGIN
  SELECT COALESCE(c.coach_id, c.trainer_id) INTO v_coach_id
  FROM public.clients c WHERE c.id = NEW.client_id;
  INSERT INTO public.client_engagement_events (client_id, coach_id, event_type, metadata)
  VALUES (
    NEW.client_id,
    v_coach_id,
    'checkin_submitted',
    jsonb_build_object('checkin_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

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
END;
$$;

-- 5) Coach can insert events for their clients (e.g. server-side or app-initiated)
DROP POLICY IF EXISTS client_engagement_events_insert_coach ON public.client_engagement_events;
CREATE POLICY client_engagement_events_insert_coach ON public.client_engagement_events
  FOR INSERT WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid() OR trainer_id = auth.uid())
  );

COMMENT ON COLUMN public.client_engagement_events.coach_id IS 'Coach (profile id) for scoring and filtering.';
COMMENT ON COLUMN public.client_engagement_events.metadata IS 'Event payload (e.g. checkin_id, session_id).';
