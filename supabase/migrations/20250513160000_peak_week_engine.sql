-- Peak Week Engine: peak_weeks (one per prep/client/show) and peak_week_days (daily protocol -7..0).
-- Uses: clients, profiles, contest_preps. RLS: coach via clients.coach_id, client via clients.user_id.
-- Existing plan-based peak_week_days (plan_id -> peak_week_plans) is renamed to peak_week_plan_days
-- so app code using it keeps working; new peak_week_days is for the engine (peak_week_id -> peak_weeks).
-- Apply: npx supabase db push (or run this SQL in the Supabase SQL editor).

-- 1) Table public.peak_weeks
CREATE TABLE IF NOT EXISTS public.peak_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  contest_prep_id UUID REFERENCES public.contest_preps(id) ON DELETE SET NULL,
  show_date DATE NOT NULL,
  division TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS peak_weeks_client_id_idx ON public.peak_weeks(client_id);
CREATE INDEX IF NOT EXISTS peak_weeks_show_date_idx ON public.peak_weeks(show_date);
CREATE INDEX IF NOT EXISTS peak_weeks_coach_id_idx ON public.peak_weeks(coach_id) WHERE coach_id IS NOT NULL;

COMMENT ON TABLE public.peak_weeks IS 'Peak week engine: one row per client/show (contest show_date). Links to contest_prep.';

-- 2) Rename existing peak_week_days (plan-based) to peak_week_plan_days; then create new peak_week_days (engine).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'peak_week_days') THEN
    ALTER TABLE public.peak_week_days RENAME TO peak_week_plan_days;
  END IF;
END $$;

CREATE TABLE public.peak_week_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  peak_week_id UUID NOT NULL REFERENCES public.peak_weeks(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  day_label TEXT,
  target_date DATE,
  carbs_g INTEGER,
  water_l NUMERIC,
  sodium_mg INTEGER,
  training_notes TEXT,
  posing_required BOOLEAN NOT NULL DEFAULT false,
  checkin_required BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT peak_week_days_day_number_check CHECK (day_number >= -7 AND day_number <= 0),
  CONSTRAINT peak_week_days_peak_week_day_unique UNIQUE (peak_week_id, day_number)
);

CREATE INDEX IF NOT EXISTS peak_week_days_peak_week_id_idx ON public.peak_week_days(peak_week_id);

COMMENT ON TABLE public.peak_week_days IS 'Peak week engine: one row per peak_week + day_number (-7 to 0). Carbs, water, sodium, posing/checkin flags.';

-- 3) RLS
ALTER TABLE public.peak_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peak_week_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS peak_weeks_select_coach ON public.peak_weeks;
DROP POLICY IF EXISTS peak_weeks_select_client ON public.peak_weeks;
DROP POLICY IF EXISTS peak_weeks_insert_coach ON public.peak_weeks;
DROP POLICY IF EXISTS peak_weeks_insert_client ON public.peak_weeks;
DROP POLICY IF EXISTS peak_weeks_update_coach ON public.peak_weeks;
DROP POLICY IF EXISTS peak_weeks_update_client ON public.peak_weeks;
DROP POLICY IF EXISTS peak_weeks_delete_coach ON public.peak_weeks;
DROP POLICY IF EXISTS peak_weeks_delete_client ON public.peak_weeks;

CREATE POLICY peak_weeks_select_coach ON public.peak_weeks FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_weeks.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid()))
);
CREATE POLICY peak_weeks_select_client ON public.peak_weeks FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_weeks.client_id AND c.user_id = auth.uid())
);
CREATE POLICY peak_weeks_insert_coach ON public.peak_weeks FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_weeks.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid()))
);
CREATE POLICY peak_weeks_insert_client ON public.peak_weeks FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_weeks.client_id AND c.user_id = auth.uid())
);
CREATE POLICY peak_weeks_update_coach ON public.peak_weeks FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_weeks.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid()))
);
CREATE POLICY peak_weeks_update_client ON public.peak_weeks FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_weeks.client_id AND c.user_id = auth.uid())
);
CREATE POLICY peak_weeks_delete_coach ON public.peak_weeks FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_weeks.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid()))
);
CREATE POLICY peak_weeks_delete_client ON public.peak_weeks FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_weeks.client_id AND c.user_id = auth.uid())
);

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
    SELECT 1 FROM public.peak_weeks pw
    JOIN public.clients c ON c.id = pw.client_id
    WHERE pw.id = peak_week_days.peak_week_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid())
  )
);
CREATE POLICY peak_week_days_select_client ON public.peak_week_days FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.peak_weeks pw
    JOIN public.clients c ON c.id = pw.client_id
    WHERE pw.id = peak_week_days.peak_week_id AND c.user_id = auth.uid()
  )
);
CREATE POLICY peak_week_days_insert_coach ON public.peak_week_days FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.peak_weeks pw
    JOIN public.clients c ON c.id = pw.client_id
    WHERE pw.id = peak_week_days.peak_week_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid())
  )
);
CREATE POLICY peak_week_days_insert_client ON public.peak_week_days FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.peak_weeks pw
    JOIN public.clients c ON c.id = pw.client_id
    WHERE pw.id = peak_week_days.peak_week_id AND c.user_id = auth.uid()
  )
);
CREATE POLICY peak_week_days_update_coach ON public.peak_week_days FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.peak_weeks pw
    JOIN public.clients c ON c.id = pw.client_id
    WHERE pw.id = peak_week_days.peak_week_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid())
  )
);
CREATE POLICY peak_week_days_update_client ON public.peak_week_days FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.peak_weeks pw
    JOIN public.clients c ON c.id = pw.client_id
    WHERE pw.id = peak_week_days.peak_week_id AND c.user_id = auth.uid()
  )
);
CREATE POLICY peak_week_days_delete_coach ON public.peak_week_days FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.peak_weeks pw
    JOIN public.clients c ON c.id = pw.client_id
    WHERE pw.id = peak_week_days.peak_week_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid())
  )
);
CREATE POLICY peak_week_days_delete_client ON public.peak_week_days FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.peak_weeks pw
    JOIN public.clients c ON c.id = pw.client_id
    WHERE pw.id = peak_week_days.peak_week_id AND c.user_id = auth.uid()
  )
);

-- Schema summary
-- ---------------
-- peak_weeks: id, client_id (FK clients), coach_id (FK profiles), contest_prep_id (FK contest_preps),
--             show_date, division, created_at, is_active. Indexes: peak_weeks_client_id_idx, peak_weeks_show_date_idx, peak_weeks_coach_id_idx.
-- peak_week_plan_days: renamed from peak_week_days; plan_id -> peak_week_plans, day_date. Kept for backward compatibility (e.g. TodayPage).
-- peak_week_days: id, peak_week_id (FK peak_weeks), day_number (-7..0), day_label, target_date,
--                 carbs_g, water_l, sodium_mg, training_notes, posing_required, checkin_required, notes, created_at.
--                 Unique (peak_week_id, day_number). Index: peak_week_days_peak_week_id_idx.
-- RLS: coach (coach_id/trainer_id) and client (user_id) SELECT/INSERT/UPDATE/DELETE on peak_weeks and peak_week_days.
