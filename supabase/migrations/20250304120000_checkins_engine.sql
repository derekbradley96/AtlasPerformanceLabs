-- Check-In Engine: focus-aware checkins table, RLS, storage bucket, and latest-checkin view.
-- Ownership: coach = clients.trainer_id = auth.uid(); client = clients.user_id = auth.uid() (add user_id on clients if missing).

-- 1) Ensure clients can be linked to auth user (for client self-service RLS)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id) WHERE user_id IS NOT NULL;

-- 2) Table public.checkins (create if not exists; then add columns if table existed)
CREATE TABLE IF NOT EXISTS public.checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  focus_type TEXT NOT NULL CHECK (focus_type IN ('transformation','competition','integrated')),
  week_start DATE NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS focus_type TEXT DEFAULT 'transformation';
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS week_start DATE;
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS weight NUMERIC;
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS steps_avg INTEGER;
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS sleep_score INTEGER;
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS energy_level INTEGER;
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS training_completion INTEGER;
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS nutrition_adherence INTEGER;
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS cardio_completion INTEGER;
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS posing_minutes INTEGER;
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS pump_quality INTEGER;
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS digestion_score INTEGER;
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS condition_notes TEXT;
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS wins TEXT;
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS struggles TEXT;
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS questions TEXT;
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.checkins ALTER COLUMN photos SET DEFAULT '[]'::jsonb;
UPDATE public.checkins SET photos = '[]'::jsonb WHERE photos IS NULL;
ALTER TABLE public.checkins ALTER COLUMN photos SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'checkins_focus_type_check') THEN
    ALTER TABLE public.checkins ADD CONSTRAINT checkins_focus_type_check CHECK (focus_type IN ('transformation','competition','integrated'));
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP INDEX IF EXISTS public.checkins_client_id_submitted_at_idx;
CREATE INDEX checkins_client_id_submitted_at_idx ON public.checkins (client_id, submitted_at DESC);

DROP INDEX IF EXISTS public.checkins_week_start_idx;
CREATE INDEX checkins_week_start_idx ON public.checkins (week_start);

ALTER TABLE public.checkins DROP CONSTRAINT IF EXISTS checkins_client_week_unique;
ALTER TABLE public.checkins ADD CONSTRAINT checkins_client_week_unique UNIQUE (client_id, week_start);

-- 3) RLS on public.checkins
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS checkins_select_coach ON public.checkins;
CREATE POLICY checkins_select_coach ON public.checkins
  FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE trainer_id = auth.uid()));

DROP POLICY IF EXISTS checkins_select_client ON public.checkins;
CREATE POLICY checkins_select_client ON public.checkins
  FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS checkins_insert_client ON public.checkins;
CREATE POLICY checkins_insert_client ON public.checkins
  FOR INSERT WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS checkins_insert_coach ON public.checkins;
CREATE POLICY checkins_insert_coach ON public.checkins
  FOR INSERT WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE trainer_id = auth.uid()));

DROP POLICY IF EXISTS checkins_update_coach ON public.checkins;
CREATE POLICY checkins_update_coach ON public.checkins
  FOR UPDATE USING (client_id IN (SELECT id FROM public.clients WHERE trainer_id = auth.uid()));

-- 4) Storage bucket checkin_photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'checkin_photos',
  'checkin_photos',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Path: {client_id}/{checkin_id}/{filename}
DROP POLICY IF EXISTS checkin_photos_select_client ON storage.objects;
CREATE POLICY checkin_photos_select_client ON storage.objects
  FOR SELECT USING (
    bucket_id = 'checkin_photos'
    AND (storage.foldername(name))[1]::uuid IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS checkin_photos_select_coach ON storage.objects;
CREATE POLICY checkin_photos_select_coach ON storage.objects
  FOR SELECT USING (
    bucket_id = 'checkin_photos'
    AND (storage.foldername(name))[1]::uuid IN (SELECT id FROM public.clients WHERE trainer_id = auth.uid())
  );

DROP POLICY IF EXISTS checkin_photos_insert_client ON storage.objects;
CREATE POLICY checkin_photos_insert_client ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'checkin_photos'
    AND (storage.foldername(name))[1]::uuid IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS checkin_photos_insert_coach ON storage.objects;
CREATE POLICY checkin_photos_insert_coach ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'checkin_photos'
    AND (storage.foldername(name))[1]::uuid IN (SELECT id FROM public.clients WHERE trainer_id = auth.uid())
  );

-- 5) View: one row per client with latest checkin and adherence fields
DROP VIEW IF EXISTS public.v_client_latest_checkin;
CREATE VIEW public.v_client_latest_checkin AS
SELECT DISTINCT ON (c.client_id)
  c.client_id,
  c.id AS checkin_id,
  c.week_start,
  c.submitted_at,
  c.focus_type,
  c.weight,
  c.steps_avg,
  c.sleep_score,
  c.energy_level,
  c.training_completion,
  c.nutrition_adherence,
  c.cardio_completion,
  c.posing_minutes,
  c.pump_quality,
  c.digestion_score,
  c.wins,
  c.struggles,
  c.questions,
  c.photos
FROM public.checkins c
ORDER BY c.client_id, c.submitted_at DESC NULLS LAST;

-- View: run as invoker so RLS on checkins applies (coach/client see only their rows).
ALTER VIEW public.v_client_latest_checkin SET (security_invoker = on);
COMMENT ON TABLE public.checkins IS 'Check-In Engine: focus-aware submissions per client per week.';
COMMENT ON VIEW public.v_client_latest_checkin IS 'One row per client_id with latest checkin and adherence fields.';
