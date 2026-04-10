-- Prep Precision Mode: fourth system layer (separate from general nutrition targets/logs).
-- Canonical: water in ml, sodium in mg. Peak overrides are date-bound and revocable (no baseline overwrite).

-- -----------------------------------------------------------------------------
-- Coach–client: precision settings (coach-owned; client read-only)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_prep_precision (
  client_id UUID PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  precision_mode_enabled BOOLEAN NOT NULL DEFAULT false,
  prep_phase TEXT,
  sodium_target_mg INTEGER,
  water_target_ml INTEGER,
  meals_per_day INTEGER,
  pre_workout_window_minutes INTEGER,
  post_workout_window_minutes INTEGER,
  meal_spacing_minutes INTEGER,
  day_type TEXT,
  is_refeed_day BOOLEAN NOT NULL DEFAULT false,
  coach_precision_notes TEXT,
  is_peak_week_override_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_prep_precision_day_type_check CHECK (
    day_type IS NULL OR day_type IN ('training', 'rest', 'high', 'low', 'refeed')
  )
);

COMMENT ON TABLE public.client_prep_precision IS 'Prep Precision Mode settings per client; separate from nutrition_plans macro targets.';

CREATE OR REPLACE FUNCTION public.set_client_prep_precision_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_prep_precision_updated_at ON public.client_prep_precision;
CREATE TRIGGER trg_client_prep_precision_updated_at
  BEFORE UPDATE ON public.client_prep_precision
  FOR EACH ROW
  EXECUTE FUNCTION public.set_client_prep_precision_updated_at();

ALTER TABLE public.client_prep_precision ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_prep_precision_select_client ON public.client_prep_precision;
CREATE POLICY client_prep_precision_select_client
  ON public.client_prep_precision FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_prep_precision.client_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS client_prep_precision_select_coach ON public.client_prep_precision;
CREATE POLICY client_prep_precision_select_coach
  ON public.client_prep_precision FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_prep_precision.client_id
        AND (c.trainer_id = auth.uid() OR c.coach_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS client_prep_precision_insert_coach ON public.client_prep_precision;
CREATE POLICY client_prep_precision_insert_coach
  ON public.client_prep_precision FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_prep_precision.client_id
        AND (c.trainer_id = auth.uid() OR c.coach_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS client_prep_precision_update_coach ON public.client_prep_precision;
CREATE POLICY client_prep_precision_update_coach
  ON public.client_prep_precision FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_prep_precision.client_id
        AND (c.trainer_id = auth.uid() OR c.coach_id = auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- Coach–client: daily precision logs (water / sodium actuals)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_prep_precision_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  day_date DATE NOT NULL,
  water_actual_ml INTEGER,
  sodium_actual_mg INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_prep_precision_daily_client_day_unique UNIQUE (client_id, day_date)
);

CREATE INDEX IF NOT EXISTS idx_client_prep_precision_daily_client_day
  ON public.client_prep_precision_daily(client_id, day_date DESC);

CREATE OR REPLACE FUNCTION public.set_client_prep_precision_daily_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_prep_precision_daily_updated_at ON public.client_prep_precision_daily;
CREATE TRIGGER trg_client_prep_precision_daily_updated_at
  BEFORE UPDATE ON public.client_prep_precision_daily
  FOR EACH ROW
  EXECUTE FUNCTION public.set_client_prep_precision_daily_updated_at();

ALTER TABLE public.client_prep_precision_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_prep_precision_daily_select_client ON public.client_prep_precision_daily;
CREATE POLICY client_prep_precision_daily_select_client
  ON public.client_prep_precision_daily FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_prep_precision_daily.client_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS client_prep_precision_daily_select_coach ON public.client_prep_precision_daily;
CREATE POLICY client_prep_precision_daily_select_coach
  ON public.client_prep_precision_daily FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_prep_precision_daily.client_id
        AND (c.trainer_id = auth.uid() OR c.coach_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS client_prep_precision_daily_upsert_client ON public.client_prep_precision_daily;
CREATE POLICY client_prep_precision_daily_upsert_client
  ON public.client_prep_precision_daily FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_prep_precision_daily.client_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS client_prep_precision_daily_update_client ON public.client_prep_precision_daily;
CREATE POLICY client_prep_precision_daily_update_client
  ON public.client_prep_precision_daily FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_prep_precision_daily.client_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS client_prep_precision_daily_upsert_coach ON public.client_prep_precision_daily;
CREATE POLICY client_prep_precision_daily_upsert_coach
  ON public.client_prep_precision_daily FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_prep_precision_daily.client_id
        AND (c.trainer_id = auth.uid() OR c.coach_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS client_prep_precision_daily_update_coach ON public.client_prep_precision_daily;
CREATE POLICY client_prep_precision_daily_update_coach
  ON public.client_prep_precision_daily FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_prep_precision_daily.client_id
        AND (c.trainer_id = auth.uid() OR c.coach_id = auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- Date-bound peak overrides (patch JSON does not replace baseline rows)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prep_peak_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  valid_from DATE NOT NULL,
  valid_to DATE NOT NULL,
  label TEXT NOT NULL DEFAULT 'Peak week override',
  overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT prep_peak_overrides_date_order CHECK (valid_to >= valid_from)
);

COMMENT ON COLUMN public.prep_peak_overrides.overrides IS 'Patch only: e.g. water_target_ml, sodium_target_mg, carbs_target_g, meal_timing, cardio_note, training_taper_note.';
COMMENT ON COLUMN public.prep_peak_overrides.revoked_at IS 'When set, override is inactive (reversible / auditable; base prep_precision row unchanged).';

CREATE INDEX IF NOT EXISTS idx_prep_peak_overrides_client_dates
  ON public.prep_peak_overrides(client_id, valid_from, valid_to);

CREATE OR REPLACE FUNCTION public.set_prep_peak_overrides_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prep_peak_overrides_updated_at ON public.prep_peak_overrides;
CREATE TRIGGER trg_prep_peak_overrides_updated_at
  BEFORE UPDATE ON public.prep_peak_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.set_prep_peak_overrides_updated_at();

ALTER TABLE public.prep_peak_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prep_peak_overrides_select_client ON public.prep_peak_overrides;
CREATE POLICY prep_peak_overrides_select_client
  ON public.prep_peak_overrides FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = prep_peak_overrides.client_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS prep_peak_overrides_select_coach ON public.prep_peak_overrides;
CREATE POLICY prep_peak_overrides_select_coach
  ON public.prep_peak_overrides FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = prep_peak_overrides.client_id
        AND (c.trainer_id = auth.uid() OR c.coach_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS prep_peak_overrides_insert_coach ON public.prep_peak_overrides;
CREATE POLICY prep_peak_overrides_insert_coach
  ON public.prep_peak_overrides FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = prep_peak_overrides.client_id
        AND (c.trainer_id = auth.uid() OR c.coach_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS prep_peak_overrides_update_coach ON public.prep_peak_overrides;
CREATE POLICY prep_peak_overrides_update_coach
  ON public.prep_peak_overrides FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = prep_peak_overrides.client_id
        AND (c.trainer_id = auth.uid() OR c.coach_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS prep_peak_overrides_delete_coach ON public.prep_peak_overrides;
CREATE POLICY prep_peak_overrides_delete_coach
  ON public.prep_peak_overrides FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = prep_peak_overrides.client_id
        AND (c.trainer_id = auth.uid() OR c.coach_id = auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- Personal: light prep precision (self-owned)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.personal_prep_precision (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  precision_mode_enabled BOOLEAN NOT NULL DEFAULT true,
  prep_phase TEXT,
  sodium_target_mg INTEGER,
  water_target_ml INTEGER,
  meals_per_day INTEGER,
  pre_workout_window_minutes INTEGER,
  post_workout_window_minutes INTEGER,
  meal_spacing_minutes INTEGER,
  day_type TEXT,
  is_refeed_day BOOLEAN NOT NULL DEFAULT false,
  prep_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT personal_prep_precision_day_type_check CHECK (
    day_type IS NULL OR day_type IN ('training', 'rest', 'high', 'low', 'refeed')
  )
);

COMMENT ON TABLE public.personal_prep_precision IS 'Personal Prep Precision (light); separate from profiles/personal general nutrition.';

CREATE OR REPLACE FUNCTION public.set_personal_prep_precision_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_personal_prep_precision_updated_at ON public.personal_prep_precision;
CREATE TRIGGER trg_personal_prep_precision_updated_at
  BEFORE UPDATE ON public.personal_prep_precision
  FOR EACH ROW
  EXECUTE FUNCTION public.set_personal_prep_precision_updated_at();

ALTER TABLE public.personal_prep_precision ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS personal_prep_precision_select_own ON public.personal_prep_precision;
CREATE POLICY personal_prep_precision_select_own
  ON public.personal_prep_precision FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS personal_prep_precision_insert_own ON public.personal_prep_precision;
CREATE POLICY personal_prep_precision_insert_own
  ON public.personal_prep_precision FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS personal_prep_precision_update_own ON public.personal_prep_precision;
CREATE POLICY personal_prep_precision_update_own
  ON public.personal_prep_precision FOR UPDATE
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.personal_prep_precision_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_date DATE NOT NULL,
  water_actual_ml INTEGER,
  sodium_actual_mg INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT personal_prep_precision_daily_user_day_unique UNIQUE (user_id, day_date)
);

CREATE INDEX IF NOT EXISTS idx_personal_prep_precision_daily_user_day
  ON public.personal_prep_precision_daily(user_id, day_date DESC);

CREATE OR REPLACE FUNCTION public.set_personal_prep_precision_daily_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_personal_prep_precision_daily_updated_at ON public.personal_prep_precision_daily;
CREATE TRIGGER trg_personal_prep_precision_daily_updated_at
  BEFORE UPDATE ON public.personal_prep_precision_daily
  FOR EACH ROW
  EXECUTE FUNCTION public.set_personal_prep_precision_daily_updated_at();

ALTER TABLE public.personal_prep_precision_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS personal_prep_precision_daily_select_own ON public.personal_prep_precision_daily;
CREATE POLICY personal_prep_precision_daily_select_own
  ON public.personal_prep_precision_daily FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS personal_prep_precision_daily_insert_own ON public.personal_prep_precision_daily;
CREATE POLICY personal_prep_precision_daily_insert_own
  ON public.personal_prep_precision_daily FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS personal_prep_precision_daily_update_own ON public.personal_prep_precision_daily;
CREATE POLICY personal_prep_precision_daily_update_own
  ON public.personal_prep_precision_daily FOR UPDATE
  USING (user_id = auth.uid());
