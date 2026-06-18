-- Coaches need to create signed URLs for client check-in
-- photos in the checkin_photos bucket.
-- Without this, only the uploading client can access photos.

-- Allow coaches to SELECT (read/sign) photos in
-- checkin_photos where the path includes their client's ID.
-- Path format: {clientId}/{checkinId}/{filename}

DROP POLICY IF EXISTS checkin_photos_coach_select
  ON storage.objects;

CREATE POLICY checkin_photos_coach_select
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'checkin_photos'
    AND (
      -- The uploader (client) can always access their photos
      owner = auth.uid()
      OR
      -- Coaches can access photos for their clients
      -- Extract clientId from path (first segment)
      split_part(name, '/', 1)::uuid IN (
        SELECT c.id
        FROM public.clients c
        WHERE
          c.coach_id = auth.uid()
          OR c.trainer_id = auth.uid()
      )
    )
  );

-- Allow clients to update photos on their own check-ins
DROP POLICY IF EXISTS checkins_update_client
  ON public.checkins;

CREATE POLICY checkins_update_client
  ON public.checkins
  FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients
      WHERE user_id = auth.uid()
    )
  );
