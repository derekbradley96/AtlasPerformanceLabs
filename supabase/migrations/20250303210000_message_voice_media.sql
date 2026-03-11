-- Voice notes: message_type, media_url, duration_ms on message_messages; message_media storage bucket.

-- Allow update (e.g. set media_url, duration_ms after voice upload)
DROP POLICY IF EXISTS message_messages_update ON public.message_messages;
CREATE POLICY message_messages_update ON public.message_messages
  FOR UPDATE USING (
    thread_id IN (SELECT id FROM public.message_threads WHERE coach_id = auth.uid())
  );

ALTER TABLE public.message_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

-- Allow empty message_text for voice messages (trigger or app sends '')
ALTER TABLE public.message_messages ALTER COLUMN message_text DROP NOT NULL;
ALTER TABLE public.message_messages ALTER COLUMN message_text SET DEFAULT '';

-- Storage bucket for message media (voice notes). Private; use signed URLs for playback.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message_media',
  'message_media',
  false,
  52428800,
  ARRAY['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/m4a']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- RLS: users can read/write objects in message_media only for threads they own (coach) or participate in (client).
-- Path format: {thread_id}/{message_id}.webm
DROP POLICY IF EXISTS message_media_select ON storage.objects;
CREATE POLICY message_media_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'message_media'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM public.message_threads WHERE coach_id = auth.uid() OR client_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS message_media_insert ON storage.objects;
CREATE POLICY message_media_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'message_media'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM public.message_threads WHERE coach_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS message_media_update ON storage.objects;
CREATE POLICY message_media_update ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'message_media'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM public.message_threads WHERE coach_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS message_media_delete ON storage.objects;
CREATE POLICY message_media_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'message_media'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM public.message_threads WHERE coach_id = auth.uid()
    )
  );
