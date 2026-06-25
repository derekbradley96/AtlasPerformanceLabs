-- Personal (solo) progress photos: profile-owned rows without a clients FK.
-- Storage path: progress_photos/personal/{profile_id}/{photo_id}.jpg

ALTER TABLE public.progress_photos
  ALTER COLUMN client_id DROP NOT NULL;

COMMENT ON COLUMN public.progress_photos.client_id IS
  'Coached client row when linked; NULL for personal self-serve uploads (profile_id required).';

-- Personal folder read/write in private bucket
DROP POLICY IF EXISTS progress_photos_storage_select_personal ON storage.objects;
CREATE POLICY progress_photos_storage_select_personal ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'progress_photos'
    AND (storage.foldername(name))[1] = 'personal'
    AND (storage.foldername(name))[2]::uuid = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS progress_photos_storage_insert_personal ON storage.objects;
CREATE POLICY progress_photos_storage_insert_personal ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'progress_photos'
    AND (storage.foldername(name))[1] = 'personal'
    AND (storage.foldername(name))[2]::uuid = (SELECT auth.uid())
  );
