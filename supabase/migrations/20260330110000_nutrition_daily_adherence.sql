-- Nutrition adherence tracking for daily macro target hit + weekly consistency.

CREATE TABLE IF NOT EXISTS public.nutrition_daily_adherence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  day_date DATE NOT NULL,
  target_calories NUMERIC,
  target_protein_g NUMERIC,
  target_carbs_g NUMERIC,
  target_fats_g NUMERIC,
  logged_calories NUMERIC NOT NULL DEFAULT 0,
  logged_protein_g NUMERIC NOT NULL DEFAULT 0,
  logged_carbs_g NUMERIC NOT NULL DEFAULT 0,
  logged_fats_g NUMERIC NOT NULL DEFAULT 0,
  macros_hit_percent NUMERIC,
  calories_hit_percent NUMERIC,
  weekly_consistency_percent NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nutrition_daily_adherence_client_day_unique'
      AND conrelid = 'public.nutrition_daily_adherence'::regclass
  ) THEN
    ALTER TABLE public.nutrition_daily_adherence
      ADD CONSTRAINT nutrition_daily_adherence_client_day_unique
      UNIQUE (client_id, day_date);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_nutrition_daily_adherence_client_day
  ON public.nutrition_daily_adherence(client_id, day_date DESC);

CREATE OR REPLACE FUNCTION public.set_nutrition_daily_adherence_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nutrition_daily_adherence_set_updated_at ON public.nutrition_daily_adherence;
CREATE TRIGGER trg_nutrition_daily_adherence_set_updated_at
BEFORE UPDATE ON public.nutrition_daily_adherence
FOR EACH ROW
EXECUTE FUNCTION public.set_nutrition_daily_adherence_updated_at();

ALTER TABLE public.nutrition_daily_adherence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nutrition_daily_adherence_select_client ON public.nutrition_daily_adherence;
CREATE POLICY nutrition_daily_adherence_select_client
ON public.nutrition_daily_adherence
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = nutrition_daily_adherence.client_id
      AND c.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS nutrition_daily_adherence_select_coach ON public.nutrition_daily_adherence;
CREATE POLICY nutrition_daily_adherence_select_coach
ON public.nutrition_daily_adherence
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = nutrition_daily_adherence.client_id
      AND (c.trainer_id = auth.uid() OR c.coach_id = auth.uid())
  )
);

DROP POLICY IF EXISTS nutrition_daily_adherence_insert_client ON public.nutrition_daily_adherence;
CREATE POLICY nutrition_daily_adherence_insert_client
ON public.nutrition_daily_adherence
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = nutrition_daily_adherence.client_id
      AND c.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS nutrition_daily_adherence_update_client ON public.nutrition_daily_adherence;
CREATE POLICY nutrition_daily_adherence_update_client
ON public.nutrition_daily_adherence
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = nutrition_daily_adherence.client_id
      AND c.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS nutrition_daily_adherence_update_coach ON public.nutrition_daily_adherence;
CREATE POLICY nutrition_daily_adherence_update_coach
ON public.nutrition_daily_adherence
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = nutrition_daily_adherence.client_id
      AND (c.trainer_id = auth.uid() OR c.coach_id = auth.uid())
  )
);
