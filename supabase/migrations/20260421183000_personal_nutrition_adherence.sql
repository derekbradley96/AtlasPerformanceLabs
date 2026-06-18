-- Personal (solo) daily nutrition adherence — mirrors nutrition_daily_adherence for profile-owned logging.

CREATE TABLE IF NOT EXISTS public.personal_nutrition_adherence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, day_date)
);

CREATE INDEX IF NOT EXISTS idx_personal_nutrition_adherence_profile_day
  ON public.personal_nutrition_adherence(profile_id, day_date DESC);

ALTER TABLE public.personal_nutrition_adherence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS personal_nutrition_adherence_own ON public.personal_nutrition_adherence;
CREATE POLICY personal_nutrition_adherence_own
  ON public.personal_nutrition_adherence
  FOR ALL TO authenticated
  USING (profile_id = (SELECT auth.uid()))
  WITH CHECK (profile_id = (SELECT auth.uid()));
