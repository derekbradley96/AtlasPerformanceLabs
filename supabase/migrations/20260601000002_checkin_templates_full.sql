-- Extend checkin_templates with goal-specific field toggles

ALTER TABLE public.checkin_templates
  ADD COLUMN IF NOT EXISTS focus_type TEXT
    DEFAULT 'transformation'
    CHECK (focus_type IN (
      'transformation','competition','integrated','general'
    ));

-- Body toggles
ALTER TABLE public.checkin_templates
  ADD COLUMN IF NOT EXISTS include_measurements BOOLEAN
    NOT NULL DEFAULT false;
ALTER TABLE public.checkin_templates
  ADD COLUMN IF NOT EXISTS include_waist BOOLEAN
    NOT NULL DEFAULT false;
ALTER TABLE public.checkin_templates
  ADD COLUMN IF NOT EXISTS include_water BOOLEAN
    NOT NULL DEFAULT false;
ALTER TABLE public.checkin_templates
  ADD COLUMN IF NOT EXISTS include_hunger BOOLEAN
    NOT NULL DEFAULT false;
ALTER TABLE public.checkin_templates
  ADD COLUMN IF NOT EXISTS include_digestion BOOLEAN
    NOT NULL DEFAULT false;
ALTER TABLE public.checkin_templates
  ADD COLUMN IF NOT EXISTS include_supplements BOOLEAN
    NOT NULL DEFAULT false;
ALTER TABLE public.checkin_templates
  ADD COLUMN IF NOT EXISTS include_cardio BOOLEAN
    NOT NULL DEFAULT false;
ALTER TABLE public.checkin_templates
  ADD COLUMN IF NOT EXISTS include_steps BOOLEAN
    NOT NULL DEFAULT false;
ALTER TABLE public.checkin_templates
  ADD COLUMN IF NOT EXISTS include_strength_feeling BOOLEAN
    NOT NULL DEFAULT false;
ALTER TABLE public.checkin_templates
  ADD COLUMN IF NOT EXISTS include_pump BOOLEAN
    NOT NULL DEFAULT false;
ALTER TABLE public.checkin_templates
  ADD COLUMN IF NOT EXISTS include_recovery BOOLEAN
    NOT NULL DEFAULT false;
ALTER TABLE public.checkin_templates
  ADD COLUMN IF NOT EXISTS include_stress BOOLEAN
    NOT NULL DEFAULT false;
ALTER TABLE public.checkin_templates
  ADD COLUMN IF NOT EXISTS include_libido BOOLEAN
    NOT NULL DEFAULT false;

-- Competition-specific toggles
ALTER TABLE public.checkin_templates
  ADD COLUMN IF NOT EXISTS include_posing BOOLEAN
    NOT NULL DEFAULT false;
ALTER TABLE public.checkin_templates
  ADD COLUMN IF NOT EXISTS include_stage_condition BOOLEAN
    NOT NULL DEFAULT false;
ALTER TABLE public.checkin_templates
  ADD COLUMN IF NOT EXISTS include_symmetry BOOLEAN
    NOT NULL DEFAULT false;
ALTER TABLE public.checkin_templates
  ADD COLUMN IF NOT EXISTS include_peak_week_metrics BOOLEAN
    NOT NULL DEFAULT false;

-- Qualitative toggles
ALTER TABLE public.checkin_templates
  ADD COLUMN IF NOT EXISTS include_wins BOOLEAN
    NOT NULL DEFAULT true;
ALTER TABLE public.checkin_templates
  ADD COLUMN IF NOT EXISTS include_struggles BOOLEAN
    NOT NULL DEFAULT true;
ALTER TABLE public.checkin_templates
  ADD COLUMN IF NOT EXISTS include_coach_questions_field BOOLEAN
    NOT NULL DEFAULT true;
