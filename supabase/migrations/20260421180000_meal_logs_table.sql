CREATE TABLE IF NOT EXISTS public.meal_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Owner: exactly one of these must be set
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  -- When
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_type TEXT NOT NULL DEFAULT 'other'
    CHECK (
      meal_type IN (
        'breakfast',
        'lunch',
        'dinner',
        'snack',
        'pre_workout',
        'post_workout',
        'other'
      )
    ),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- What
  food_name TEXT NOT NULL DEFAULT '',
  calories NUMERIC,
  protein_g NUMERIC,
  carbs_g NUMERIC,
  fats_g NUMERIC,
  -- Optional detail
  portion_grams NUMERIC,
  portion_unit TEXT,
  barcode TEXT,
  notes TEXT,
  source TEXT DEFAULT 'manual'
    CHECK (source IN ('manual', 'barcode', 'quick_add', 'template')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT meal_logs_owner_exactly_one
    CHECK ((profile_id IS NOT NULL) <> (client_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_meal_logs_profile_date
  ON public.meal_logs(profile_id, log_date DESC)
  WHERE profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meal_logs_client_date
  ON public.meal_logs(client_id, log_date DESC)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meal_logs_barcode
  ON public.meal_logs(barcode)
  WHERE barcode IS NOT NULL;

ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;

-- Personal user: owns their own logs via profile_id
DROP POLICY IF EXISTS meal_logs_select_personal ON public.meal_logs;
CREATE POLICY meal_logs_select_personal ON public.meal_logs
  FOR SELECT TO authenticated USING (
    profile_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS meal_logs_insert_personal ON public.meal_logs;
CREATE POLICY meal_logs_insert_personal ON public.meal_logs
  FOR INSERT TO authenticated WITH CHECK (
    profile_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS meal_logs_update_personal ON public.meal_logs;
CREATE POLICY meal_logs_update_personal ON public.meal_logs
  FOR UPDATE TO authenticated USING (
    profile_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS meal_logs_delete_personal ON public.meal_logs;
CREATE POLICY meal_logs_delete_personal ON public.meal_logs
  FOR DELETE TO authenticated USING (
    profile_id = (SELECT auth.uid())
  );

-- Client: owns logs via clients.user_id
DROP POLICY IF EXISTS meal_logs_select_client ON public.meal_logs;
CREATE POLICY meal_logs_select_client ON public.meal_logs
  FOR SELECT TO authenticated USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS meal_logs_insert_client ON public.meal_logs;
CREATE POLICY meal_logs_insert_client ON public.meal_logs
  FOR INSERT TO authenticated WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients
      WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS meal_logs_update_client ON public.meal_logs;
CREATE POLICY meal_logs_update_client ON public.meal_logs
  FOR UPDATE TO authenticated USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS meal_logs_delete_client ON public.meal_logs;
CREATE POLICY meal_logs_delete_client ON public.meal_logs
  FOR DELETE TO authenticated USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- Coach: read-only access to clients' food diary
DROP POLICY IF EXISTS meal_logs_select_coach ON public.meal_logs;
CREATE POLICY meal_logs_select_coach ON public.meal_logs
  FOR SELECT TO authenticated USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE COALESCE(coach_id, trainer_id) = (SELECT auth.uid())
    )
  );

-- Keep personal nutrition target columns available on profiles.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nutrition_calories NUMERIC,
  ADD COLUMN IF NOT EXISTS nutrition_protein_g NUMERIC,
  ADD COLUMN IF NOT EXISTS nutrition_carbs_g NUMERIC,
  ADD COLUMN IF NOT EXISTS nutrition_fats_g NUMERIC,
  ADD COLUMN IF NOT EXISTS nutrition_targets_updated_at TIMESTAMPTZ;
