-- Progress photos: table, RLS, private storage bucket (signed URLs).
-- Path format: progress_photos/{client_id}/{photo_id}.jpg

CREATE TABLE IF NOT EXISTS public.progress_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  coach_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  date_taken DATE NOT NULL DEFAULT CURRENT_DATE,
  tag TEXT NOT NULL DEFAULT 'front'
    CHECK (tag IN ('front','back','side_left','side_right','custom')),
  notes TEXT,
  weight_kg NUMERIC,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_progress_photos_client_id
  ON public.progress_photos(client_id);
CREATE INDEX IF NOT EXISTS idx_progress_photos_date_taken
  ON public.progress_photos(date_taken DESC);
CREATE INDEX IF NOT EXISTS idx_progress_photos_profile_id
  ON public.progress_photos(profile_id);

ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.progress_photos TO authenticated;

-- Client can read and insert their own photos
DROP POLICY IF EXISTS progress_photos_select_client ON public.progress_photos;
CREATE POLICY progress_photos_select_client ON public.progress_photos
  FOR SELECT TO authenticated USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE user_id = (SELECT auth.uid())
    )
    OR profile_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS progress_photos_insert_client ON public.progress_photos;
CREATE POLICY progress_photos_insert_client ON public.progress_photos
  FOR INSERT TO authenticated WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients
      WHERE user_id = (SELECT auth.uid())
    )
    OR profile_id = (SELECT auth.uid())
  );

-- Coach can insert photos for clients on their roster (upload on behalf)
DROP POLICY IF EXISTS progress_photos_insert_coach ON public.progress_photos;
CREATE POLICY progress_photos_insert_coach ON public.progress_photos
  FOR INSERT TO authenticated WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients
      WHERE COALESCE(coach_id, trainer_id) = (SELECT auth.uid())
    )
  );

-- Coach can read and soft-delete their clients' photos
DROP POLICY IF EXISTS progress_photos_select_coach ON public.progress_photos;
CREATE POLICY progress_photos_select_coach ON public.progress_photos
  FOR SELECT TO authenticated USING (
    coach_id = (SELECT auth.uid())
    OR client_id IN (
      SELECT id FROM public.clients
      WHERE COALESCE(coach_id, trainer_id) = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS progress_photos_update_coach ON public.progress_photos;
CREATE POLICY progress_photos_update_coach ON public.progress_photos
  FOR UPDATE TO authenticated USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE COALESCE(coach_id, trainer_id) = (SELECT auth.uid())
    )
  );

-- Storage bucket for progress photos (private, signed URLs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'progress_photos',
  'progress_photos',
  false,
  20971520,
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS: path format {client_id}/{photo_id}.{ext}
DROP POLICY IF EXISTS progress_photos_storage_select ON storage.objects;
CREATE POLICY progress_photos_storage_select ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'progress_photos'
    AND (
      (storage.foldername(name))[1]::uuid IN (
        SELECT id FROM public.clients
        WHERE user_id = (SELECT auth.uid())
      )
      OR (storage.foldername(name))[1]::uuid IN (
        SELECT id FROM public.clients
        WHERE COALESCE(coach_id, trainer_id) = (SELECT auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS progress_photos_storage_insert ON storage.objects;
CREATE POLICY progress_photos_storage_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'progress_photos'
    AND (
      (storage.foldername(name))[1]::uuid IN (
        SELECT id FROM public.clients
        WHERE user_id = (SELECT auth.uid())
          OR COALESCE(coach_id, trainer_id) = (SELECT auth.uid())
      )
    )
  );
