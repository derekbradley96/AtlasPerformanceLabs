-- Progress -> Check-ins -> Adjustments loop (Atlas-aligned).
-- Note: canonical coached check-ins already live in public.checkins (client_id based).
-- For personal users, persist daily check-ins in public.personal_checkins.

CREATE TABLE IF NOT EXISTS public.personal_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  weight NUMERIC,
  energy INTEGER CHECK (energy BETWEEN 1 AND 5),
  sleep INTEGER CHECK (sleep BETWEEN 1 AND 5),
  stress INTEGER CHECK (stress BETWEEN 1 AND 5),
  hunger INTEGER CHECK (hunger BETWEEN 1 AND 5),
  adherence INTEGER CHECK (adherence BETWEEN 0 AND 100),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personal_checkins_user_created
  ON public.personal_checkins(user_id, created_at DESC);

ALTER TABLE public.client_state
  ADD COLUMN IF NOT EXISTS weight_trend TEXT,
  ADD COLUMN IF NOT EXISTS strength_trend TEXT,
  ADD COLUMN IF NOT EXISTS risk_flag BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS public.program_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL,
  reason TEXT,
  previous_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  applied_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'applied',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_program_adjustments_profile_created
  ON public.program_adjustments(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_program_adjustments_client_created
  ON public.program_adjustments(client_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.nutrition_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL,
  reason TEXT,
  previous_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  applied_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'applied',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nutrition_adjustments_profile_created
  ON public.nutrition_adjustments(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nutrition_adjustments_client_created
  ON public.nutrition_adjustments(client_id, created_at DESC);

ALTER TABLE public.personal_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS personal_checkins_select_own ON public.personal_checkins;
CREATE POLICY personal_checkins_select_own
  ON public.personal_checkins
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS personal_checkins_insert_own ON public.personal_checkins;
CREATE POLICY personal_checkins_insert_own
  ON public.personal_checkins
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS personal_checkins_update_own ON public.personal_checkins;
CREATE POLICY personal_checkins_update_own
  ON public.personal_checkins
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS program_adjustments_select_own ON public.program_adjustments;
CREATE POLICY program_adjustments_select_own
  ON public.program_adjustments
  FOR SELECT
  USING (
    auth.uid() = profile_id
    OR auth.uid() = coach_id
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = program_adjustments.client_id
        AND (c.user_id = auth.uid() OR c.coach_id = auth.uid() OR c.trainer_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS program_adjustments_insert_coach_or_self ON public.program_adjustments;
CREATE POLICY program_adjustments_insert_coach_or_self
  ON public.program_adjustments
  FOR INSERT
  WITH CHECK (auth.uid() = profile_id OR auth.uid() = coach_id);

DROP POLICY IF EXISTS nutrition_adjustments_select_own ON public.nutrition_adjustments;
CREATE POLICY nutrition_adjustments_select_own
  ON public.nutrition_adjustments
  FOR SELECT
  USING (
    auth.uid() = profile_id
    OR auth.uid() = coach_id
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = nutrition_adjustments.client_id
        AND (c.user_id = auth.uid() OR c.coach_id = auth.uid() OR c.trainer_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS nutrition_adjustments_insert_coach_or_self ON public.nutrition_adjustments;
CREATE POLICY nutrition_adjustments_insert_coach_or_self
  ON public.nutrition_adjustments
  FOR INSERT
  WITH CHECK (auth.uid() = profile_id OR auth.uid() = coach_id);
