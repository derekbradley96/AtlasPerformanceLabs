UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/mp4',
  'audio/m4a',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm'
]::text[],
file_size_limit = 104857600
WHERE id = 'message_media';

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
