-- Extend checkins table with full field set for both
-- transformation and competition clients

ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS focus_type TEXT
    DEFAULT 'transformation'
    CHECK (focus_type IN (
      'transformation','competition','integrated','general'
    ));

-- Body metrics
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS weight NUMERIC;
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC;
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS waist_cm NUMERIC;
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS chest_cm NUMERIC;
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS hip_cm NUMERIC;
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS thigh_cm NUMERIC;
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS arm_cm NUMERIC;

-- Nutrition
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS nutrition_adherence INTEGER
    CHECK (nutrition_adherence BETWEEN 0 AND 100);
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS water_litres NUMERIC;
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS hunger_level INTEGER
    CHECK (hunger_level BETWEEN 1 AND 10);
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS cravings_level INTEGER
    CHECK (cravings_level BETWEEN 1 AND 10);
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS digestion_score INTEGER
    CHECK (digestion_score BETWEEN 1 AND 10);
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS supplement_adherence INTEGER
    CHECK (supplement_adherence BETWEEN 0 AND 100);

-- Training
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS training_completion INTEGER
    CHECK (training_completion BETWEEN 0 AND 100);
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS cardio_completion INTEGER
    CHECK (cardio_completion BETWEEN 0 AND 100);
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS strength_feeling INTEGER
    CHECK (strength_feeling BETWEEN 1 AND 10);
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS pump_quality INTEGER
    CHECK (pump_quality BETWEEN 1 AND 10);
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS recovery_score INTEGER
    CHECK (recovery_score BETWEEN 1 AND 10);
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS steps_avg INTEGER;

-- Wellbeing
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS sleep_score INTEGER
    CHECK (sleep_score BETWEEN 1 AND 10);
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS sleep_hours NUMERIC;
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS energy_level INTEGER
    CHECK (energy_level BETWEEN 1 AND 10);
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS mood_level INTEGER
    CHECK (mood_level BETWEEN 1 AND 10);
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS stress_level INTEGER
    CHECK (stress_level BETWEEN 1 AND 10);
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS libido_level INTEGER
    CHECK (libido_level BETWEEN 1 AND 10);

-- Competition-specific
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS posing_minutes INTEGER;
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS stage_condition_notes TEXT;
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS symmetry_notes TEXT;
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS peak_week_water_litres NUMERIC;
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS peak_week_sodium_mg INTEGER;
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS peak_week_carb_g INTEGER;

-- Qualitative
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS wins TEXT;
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS struggles TEXT;
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS coach_questions TEXT;
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS answers JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS condition_notes TEXT;

-- Review
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS status TEXT
    NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending','submitted','reviewed','actioned'
    ));
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS coach_review_notes TEXT;
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS coach_review_tags JSONB
    DEFAULT '[]'::jsonb;
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS reviewed_by UUID;
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS coach_response TEXT;
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS coach_response_sent_at TIMESTAMPTZ;
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS photos JSONB
    NOT NULL DEFAULT '[]'::jsonb;
