-- Public profile avatars: stable HTTPS URLs in profiles.avatar_url (used in marketplace, discovery, messaging).
-- Path: {user_id}/avatar.{ext} — only the owner can write; anyone can read (public bucket).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile_images',
  'profile_images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS profile_images_select_anon ON storage.objects;
CREATE POLICY profile_images_select_anon ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'profile_images');

DROP POLICY IF EXISTS profile_images_insert_own ON storage.objects;
CREATE POLICY profile_images_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile_images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS profile_images_update_own ON storage.objects;
CREATE POLICY profile_images_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'profile_images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'profile_images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS profile_images_delete_own ON storage.objects;
CREATE POLICY profile_images_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'profile_images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
