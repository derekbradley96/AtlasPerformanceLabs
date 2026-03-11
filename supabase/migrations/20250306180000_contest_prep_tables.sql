-- Contest prep system: contest_preps, pose_checks, peak_week_plans, peak_week_days.
-- Exact columns per spec. Use IF NOT EXISTS so safe with or without 20250306150000.

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

CREATE UNIQUE INDEX IF NOT EXISTS contest_preps_active_unique
  ON public.contest_preps(client_id) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.pose_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  prep_id UUID REFERENCES public.contest_preps(id) ON DELETE SET NULL,
  week_start DATE NOT NULL,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  client_notes TEXT,
  coach_rating INTEGER,
  coach_notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS pose_checks_week_unique ON public.pose_checks(client_id, week_start);
CREATE INDEX IF NOT EXISTS pose_checks_client_submitted_idx ON public.pose_checks(client_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS public.peak_week_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  prep_id UUID REFERENCES public.contest_preps(id) ON DELETE SET NULL,
  week_start DATE NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS peak_week_plan_unique ON public.peak_week_plans(client_id, week_start);

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

CREATE UNIQUE INDEX IF NOT EXISTS peak_week_days_unique ON public.peak_week_days(plan_id, day_date);

-- RLS (idempotent; matches docs/DB_OWNERSHIP_RULES.md)
ALTER TABLE public.contest_preps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pose_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peak_week_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peak_week_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contest_preps_select_client ON public.contest_preps;
DROP POLICY IF EXISTS contest_preps_select_coach ON public.contest_preps;
DROP POLICY IF EXISTS contest_preps_insert_client ON public.contest_preps;
DROP POLICY IF EXISTS contest_preps_insert_coach ON public.contest_preps;
DROP POLICY IF EXISTS contest_preps_update_client ON public.contest_preps;
DROP POLICY IF EXISTS contest_preps_update_coach ON public.contest_preps;
DROP POLICY IF EXISTS contest_preps_delete_client ON public.contest_preps;
DROP POLICY IF EXISTS contest_preps_delete_coach ON public.contest_preps;

CREATE POLICY contest_preps_select_client ON public.contest_preps FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
CREATE POLICY contest_preps_select_coach ON public.contest_preps FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid()));
CREATE POLICY contest_preps_insert_client ON public.contest_preps FOR INSERT WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
CREATE POLICY contest_preps_insert_coach ON public.contest_preps FOR INSERT WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid()));
CREATE POLICY contest_preps_update_client ON public.contest_preps FOR UPDATE USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
CREATE POLICY contest_preps_update_coach ON public.contest_preps FOR UPDATE USING (client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid()));
CREATE POLICY contest_preps_delete_client ON public.contest_preps FOR DELETE USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
CREATE POLICY contest_preps_delete_coach ON public.contest_preps FOR DELETE USING (client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid()));

DROP POLICY IF EXISTS pose_checks_select_client ON public.pose_checks;
DROP POLICY IF EXISTS pose_checks_select_coach ON public.pose_checks;
DROP POLICY IF EXISTS pose_checks_insert_client ON public.pose_checks;
DROP POLICY IF EXISTS pose_checks_insert_coach ON public.pose_checks;
DROP POLICY IF EXISTS pose_checks_update_client ON public.pose_checks;
DROP POLICY IF EXISTS pose_checks_update_coach ON public.pose_checks;
DROP POLICY IF EXISTS pose_checks_delete_client ON public.pose_checks;
DROP POLICY IF EXISTS pose_checks_delete_coach ON public.pose_checks;

CREATE POLICY pose_checks_select_client ON public.pose_checks FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
CREATE POLICY pose_checks_select_coach ON public.pose_checks FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid()));
CREATE POLICY pose_checks_insert_client ON public.pose_checks FOR INSERT WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
CREATE POLICY pose_checks_insert_coach ON public.pose_checks FOR INSERT WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid()));
CREATE POLICY pose_checks_update_client ON public.pose_checks FOR UPDATE USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
CREATE POLICY pose_checks_update_coach ON public.pose_checks FOR UPDATE USING (client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid()));
CREATE POLICY pose_checks_delete_client ON public.pose_checks FOR DELETE USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
CREATE POLICY pose_checks_delete_coach ON public.pose_checks FOR DELETE USING (client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid()));

DROP POLICY IF EXISTS peak_week_plans_select_client ON public.peak_week_plans;
DROP POLICY IF EXISTS peak_week_plans_select_coach ON public.peak_week_plans;
DROP POLICY IF EXISTS peak_week_plans_insert_client ON public.peak_week_plans;
DROP POLICY IF EXISTS peak_week_plans_insert_coach ON public.peak_week_plans;
DROP POLICY IF EXISTS peak_week_plans_update_client ON public.peak_week_plans;
DROP POLICY IF EXISTS peak_week_plans_update_coach ON public.peak_week_plans;
DROP POLICY IF EXISTS peak_week_plans_delete_client ON public.peak_week_plans;
DROP POLICY IF EXISTS peak_week_plans_delete_coach ON public.peak_week_plans;

CREATE POLICY peak_week_plans_select_client ON public.peak_week_plans FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
CREATE POLICY peak_week_plans_select_coach ON public.peak_week_plans FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid()));
CREATE POLICY peak_week_plans_insert_client ON public.peak_week_plans FOR INSERT WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
CREATE POLICY peak_week_plans_insert_coach ON public.peak_week_plans FOR INSERT WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid()));
CREATE POLICY peak_week_plans_update_client ON public.peak_week_plans FOR UPDATE USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
CREATE POLICY peak_week_plans_update_coach ON public.peak_week_plans FOR UPDATE USING (client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid()));
CREATE POLICY peak_week_plans_delete_client ON public.peak_week_plans FOR DELETE USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
CREATE POLICY peak_week_plans_delete_coach ON public.peak_week_plans FOR DELETE USING (client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid()));

DROP POLICY IF EXISTS peak_week_days_select_client ON public.peak_week_days;
DROP POLICY IF EXISTS peak_week_days_select_coach ON public.peak_week_days;
DROP POLICY IF EXISTS peak_week_days_insert_client ON public.peak_week_days;
DROP POLICY IF EXISTS peak_week_days_insert_coach ON public.peak_week_days;
DROP POLICY IF EXISTS peak_week_days_update_client ON public.peak_week_days;
DROP POLICY IF EXISTS peak_week_days_update_coach ON public.peak_week_days;
DROP POLICY IF EXISTS peak_week_days_delete_client ON public.peak_week_days;
DROP POLICY IF EXISTS peak_week_days_delete_coach ON public.peak_week_days;

CREATE POLICY peak_week_days_select_client ON public.peak_week_days FOR SELECT USING (
  plan_id IN (SELECT id FROM public.peak_week_plans WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()))
);
CREATE POLICY peak_week_days_select_coach ON public.peak_week_days FOR SELECT USING (
  plan_id IN (SELECT id FROM public.peak_week_plans WHERE client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid()))
);
CREATE POLICY peak_week_days_insert_client ON public.peak_week_days FOR INSERT WITH CHECK (
  plan_id IN (SELECT id FROM public.peak_week_plans WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()))
);
CREATE POLICY peak_week_days_insert_coach ON public.peak_week_days FOR INSERT WITH CHECK (
  plan_id IN (SELECT id FROM public.peak_week_plans WHERE client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid()))
);
CREATE POLICY peak_week_days_update_client ON public.peak_week_days FOR UPDATE USING (
  plan_id IN (SELECT id FROM public.peak_week_plans WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()))
);
CREATE POLICY peak_week_days_update_coach ON public.peak_week_days FOR UPDATE USING (
  plan_id IN (SELECT id FROM public.peak_week_plans WHERE client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid()))
);
CREATE POLICY peak_week_days_delete_client ON public.peak_week_days FOR DELETE USING (
  plan_id IN (SELECT id FROM public.peak_week_plans WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()))
);
CREATE POLICY peak_week_days_delete_coach ON public.peak_week_days FOR DELETE USING (
  plan_id IN (SELECT id FROM public.peak_week_plans WHERE client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid()))
);
