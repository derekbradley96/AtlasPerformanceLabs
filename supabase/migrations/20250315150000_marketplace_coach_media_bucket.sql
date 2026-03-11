-- Storage bucket for marketplace coach profile images (and optional video).
-- Path: {coach_id}/{filename}. Coach can upload/read/delete own; public read via signed URLs when profile is listed.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketplace_coach_media',
  'marketplace_coach_media',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Coach can SELECT/INSERT/UPDATE/DELETE objects under path starting with their own id (first segment = auth.uid())
DROP POLICY IF EXISTS marketplace_coach_media_coach_all ON storage.objects;
CREATE POLICY marketplace_coach_media_coach_all ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'marketplace_coach_media'
    AND (storage.foldername(name))[1]::text = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'marketplace_coach_media'
    AND (storage.foldername(name))[1]::text = auth.uid()::text
  );
