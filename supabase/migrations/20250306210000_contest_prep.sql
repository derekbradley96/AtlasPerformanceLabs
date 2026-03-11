-- Contest Prep Command Center: tables, RLS, storage bucket.
-- Ownership: coach via clients.coach_id = auth.uid(); client via clients.user_id = auth.uid().

-- A) public.contest_preps
CREATE TABLE IF NOT EXISTS public.contest_preps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  show_name TEXT,
  federation TEXT,
  division TEXT,
  show_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX IF NOT EXISTS contest_preps_one_active
  ON public.contest_preps(client_id) WHERE is_active = true;

-- B) public.pose_checks
CREATE TABLE IF NOT EXISTS public.pose_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  prep_id UUID REFERENCES public.contest_preps(id) ON DELETE SET NULL,
  week_start DATE NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  client_notes TEXT,
  coach_rating INTEGER,
  coach_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID
);
ALTER TABLE public.pose_checks ADD COLUMN IF NOT EXISTS reviewed_by UUID;
CREATE UNIQUE INDEX IF NOT EXISTS pose_checks_client_week_unique ON public.pose_checks(client_id, week_start);
CREATE INDEX IF NOT EXISTS pose_checks_client_submitted_idx ON public.pose_checks(client_id, submitted_at DESC);

-- C) public.peak_week_plans
CREATE TABLE IF NOT EXISTS public.peak_week_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  prep_id UUID REFERENCES public.contest_preps(id) ON DELETE SET NULL,
  week_start DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS peak_week_plans_client_week_unique ON public.peak_week_plans(client_id, week_start);
ALTER TABLE public.peak_week_plans ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- D) public.peak_week_days
CREATE TABLE IF NOT EXISTS public.peak_week_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.peak_week_plans(id) ON DELETE CASCADE,
  day_date DATE NOT NULL,
  carbs_g INTEGER,
  water_l NUMERIC,
  sodium_mg INTEGER,
  training_notes TEXT,
  cardio_notes TEXT,
  notes TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS peak_week_days_plan_date_unique ON public.peak_week_days(plan_id, day_date);

-- RLS: enable on all tables
ALTER TABLE public.contest_preps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pose_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peak_week_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peak_week_days ENABLE ROW LEVEL SECURITY;

-- Helper: coach owns row if client belongs to coach
-- Coach: EXISTS (SELECT 1 FROM public.clients c WHERE c.id = <table>.client_id AND c.coach_id = auth.uid())
-- Client: client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())

-- contest_preps
DROP POLICY IF EXISTS contest_preps_select_coach ON public.contest_preps;
DROP POLICY IF EXISTS contest_preps_select_client ON public.contest_preps;
DROP POLICY IF EXISTS contest_preps_insert_coach ON public.contest_preps;
DROP POLICY IF EXISTS contest_preps_insert_client ON public.contest_preps;
DROP POLICY IF EXISTS contest_preps_update_coach ON public.contest_preps;
DROP POLICY IF EXISTS contest_preps_update_client ON public.contest_preps;
DROP POLICY IF EXISTS contest_preps_delete_coach ON public.contest_preps;
DROP POLICY IF EXISTS contest_preps_delete_client ON public.contest_preps;

CREATE POLICY contest_preps_select_coach ON public.contest_preps FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = contest_preps.client_id AND c.coach_id = auth.uid())
);
CREATE POLICY contest_preps_select_client ON public.contest_preps FOR SELECT USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);
CREATE POLICY contest_preps_insert_coach ON public.contest_preps FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = contest_preps.client_id AND c.coach_id = auth.uid())
);
CREATE POLICY contest_preps_insert_client ON public.contest_preps FOR INSERT WITH CHECK (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);
CREATE POLICY contest_preps_update_coach ON public.contest_preps FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = contest_preps.client_id AND c.coach_id = auth.uid())
);
CREATE POLICY contest_preps_update_client ON public.contest_preps FOR UPDATE USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);
CREATE POLICY contest_preps_delete_coach ON public.contest_preps FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = contest_preps.client_id AND c.coach_id = auth.uid())
);
CREATE POLICY contest_preps_delete_client ON public.contest_preps FOR DELETE USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);

-- pose_checks
DROP POLICY IF EXISTS pose_checks_select_coach ON public.pose_checks;
DROP POLICY IF EXISTS pose_checks_select_client ON public.pose_checks;
DROP POLICY IF EXISTS pose_checks_insert_coach ON public.pose_checks;
DROP POLICY IF EXISTS pose_checks_insert_client ON public.pose_checks;
DROP POLICY IF EXISTS pose_checks_update_coach ON public.pose_checks;
DROP POLICY IF EXISTS pose_checks_update_client ON public.pose_checks;
DROP POLICY IF EXISTS pose_checks_delete_coach ON public.pose_checks;
DROP POLICY IF EXISTS pose_checks_delete_client ON public.pose_checks;

CREATE POLICY pose_checks_select_coach ON public.pose_checks FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = pose_checks.client_id AND c.coach_id = auth.uid())
);
CREATE POLICY pose_checks_select_client ON public.pose_checks FOR SELECT USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);
CREATE POLICY pose_checks_insert_coach ON public.pose_checks FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = pose_checks.client_id AND c.coach_id = auth.uid())
);
CREATE POLICY pose_checks_insert_client ON public.pose_checks FOR INSERT WITH CHECK (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);
CREATE POLICY pose_checks_update_coach ON public.pose_checks FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = pose_checks.client_id AND c.coach_id = auth.uid())
);
CREATE POLICY pose_checks_update_client ON public.pose_checks FOR UPDATE USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);
CREATE POLICY pose_checks_delete_coach ON public.pose_checks FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = pose_checks.client_id AND c.coach_id = auth.uid())
);
CREATE POLICY pose_checks_delete_client ON public.pose_checks FOR DELETE USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);

-- peak_week_plans
DROP POLICY IF EXISTS peak_week_plans_select_coach ON public.peak_week_plans;
DROP POLICY IF EXISTS peak_week_plans_select_client ON public.peak_week_plans;
DROP POLICY IF EXISTS peak_week_plans_insert_coach ON public.peak_week_plans;
DROP POLICY IF EXISTS peak_week_plans_insert_client ON public.peak_week_plans;
DROP POLICY IF EXISTS peak_week_plans_update_coach ON public.peak_week_plans;
DROP POLICY IF EXISTS peak_week_plans_update_client ON public.peak_week_plans;
DROP POLICY IF EXISTS peak_week_plans_delete_coach ON public.peak_week_plans;
DROP POLICY IF EXISTS peak_week_plans_delete_client ON public.peak_week_plans;

CREATE POLICY peak_week_plans_select_coach ON public.peak_week_plans FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_week_plans.client_id AND c.coach_id = auth.uid())
);
CREATE POLICY peak_week_plans_select_client ON public.peak_week_plans FOR SELECT USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);
CREATE POLICY peak_week_plans_insert_coach ON public.peak_week_plans FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_week_plans.client_id AND c.coach_id = auth.uid())
);
CREATE POLICY peak_week_plans_insert_client ON public.peak_week_plans FOR INSERT WITH CHECK (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);
CREATE POLICY peak_week_plans_update_coach ON public.peak_week_plans FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_week_plans.client_id AND c.coach_id = auth.uid())
);
CREATE POLICY peak_week_plans_update_client ON public.peak_week_plans FOR UPDATE USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);
CREATE POLICY peak_week_plans_delete_coach ON public.peak_week_plans FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_week_plans.client_id AND c.coach_id = auth.uid())
);
CREATE POLICY peak_week_plans_delete_client ON public.peak_week_plans FOR DELETE USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);

-- peak_week_days (ownership via plan_id -> peak_week_plans.client_id)
DROP POLICY IF EXISTS peak_week_days_select_coach ON public.peak_week_days;
DROP POLICY IF EXISTS peak_week_days_select_client ON public.peak_week_days;
DROP POLICY IF EXISTS peak_week_days_insert_coach ON public.peak_week_days;
DROP POLICY IF EXISTS peak_week_days_insert_client ON public.peak_week_days;
DROP POLICY IF EXISTS peak_week_days_update_coach ON public.peak_week_days;
DROP POLICY IF EXISTS peak_week_days_update_client ON public.peak_week_days;
DROP POLICY IF EXISTS peak_week_days_delete_coach ON public.peak_week_days;
DROP POLICY IF EXISTS peak_week_days_delete_client ON public.peak_week_days;

CREATE POLICY peak_week_days_select_coach ON public.peak_week_days FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.peak_week_plans p
    JOIN public.clients c ON c.id = p.client_id AND c.coach_id = auth.uid()
    WHERE p.id = peak_week_days.plan_id
  )
);
CREATE POLICY peak_week_days_select_client ON public.peak_week_days FOR SELECT USING (
  plan_id IN (
    SELECT id FROM public.peak_week_plans
    WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  )
);
CREATE POLICY peak_week_days_insert_coach ON public.peak_week_days FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.peak_week_plans p
    JOIN public.clients c ON c.id = p.client_id AND c.coach_id = auth.uid()
    WHERE p.id = peak_week_days.plan_id
  )
);
CREATE POLICY peak_week_days_insert_client ON public.peak_week_days FOR INSERT WITH CHECK (
  plan_id IN (
    SELECT id FROM public.peak_week_plans
    WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  )
);
CREATE POLICY peak_week_days_update_coach ON public.peak_week_days FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.peak_week_plans p
    JOIN public.clients c ON c.id = p.client_id AND c.coach_id = auth.uid()
    WHERE p.id = peak_week_days.plan_id
  )
);
CREATE POLICY peak_week_days_update_client ON public.peak_week_days FOR UPDATE USING (
  plan_id IN (
    SELECT id FROM public.peak_week_plans
    WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  )
);
CREATE POLICY peak_week_days_delete_coach ON public.peak_week_days FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.peak_week_plans p
    JOIN public.clients c ON c.id = p.client_id AND c.coach_id = auth.uid()
    WHERE p.id = peak_week_days.plan_id
  )
);
CREATE POLICY peak_week_days_delete_client ON public.peak_week_days FOR DELETE USING (
  plan_id IN (
    SELECT id FROM public.peak_week_plans
    WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  )
);

-- Storage: pose_check_photos (private). Path: {client_id}/{pose_check_id}/{filename}
-- Coach: read. Client: upload + read own (path first segment = their client_id).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pose_check_photos',
  'pose_check_photos',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS pose_check_photos_select_coach ON storage.objects;
DROP POLICY IF EXISTS pose_check_photos_select_client ON storage.objects;
DROP POLICY IF EXISTS pose_check_photos_insert_client ON storage.objects;

-- Coach can read: first path segment (client_id) must be a client they own
CREATE POLICY pose_check_photos_select_coach ON storage.objects
  FOR SELECT USING (
    bucket_id = 'pose_check_photos'
    AND (storage.foldername(name))[1]::uuid IN (SELECT id FROM public.clients WHERE coach_id = auth.uid())
  );

-- Client can read: first path segment is their client_id
CREATE POLICY pose_check_photos_select_client ON storage.objects
  FOR SELECT USING (
    bucket_id = 'pose_check_photos'
    AND (storage.foldername(name))[1]::uuid IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

-- Client can upload only under their client_id path
CREATE POLICY pose_check_photos_insert_client ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'pose_check_photos'
    AND (storage.foldername(name))[1]::uuid IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

COMMENT ON TABLE public.contest_preps IS 'Contest prep command center: one active prep per client.';
COMMENT ON TABLE public.pose_checks IS 'Pose check submissions per client/week; photos in storage pose_check_photos {client_id}/{pose_check_id}/{filename}.';
COMMENT ON TABLE public.peak_week_plans IS 'Peak week plan per client/week.';
COMMENT ON TABLE public.peak_week_days IS 'Daily plan rows for a peak week.';
