-- Allow authenticated users to read marketplace_coach_media storage objects for listed coaches only.
-- Enables coach discovery page to show profile images via signed URLs.

DROP POLICY IF EXISTS marketplace_coach_media_listed_select ON storage.objects;
CREATE POLICY marketplace_coach_media_listed_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'marketplace_coach_media'
    AND (storage.foldername(name))[1]::text IN (
      SELECT coach_id::text FROM public.marketplace_coach_profiles WHERE is_listed = true
    )
  );
