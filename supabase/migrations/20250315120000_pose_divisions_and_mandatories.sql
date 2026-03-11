-- Division-aware mandatory pose definitions for contest prep and pose checks.
-- Tables: pose_division_templates, pose_template_items.
-- contest_preps: add division_key for normalized reference.

-- 1) Division templates (one row per division)
CREATE TABLE IF NOT EXISTS public.pose_division_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_key TEXT NOT NULL UNIQUE,
  division_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('mens', 'womens')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Mandatory/optional poses per division
CREATE TABLE IF NOT EXISTS public.pose_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.pose_division_templates(id) ON DELETE CASCADE,
  pose_key TEXT NOT NULL,
  pose_label TEXT NOT NULL,
  pose_group TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_mandatory BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS pose_template_items_template_id_idx
  ON public.pose_template_items(template_id);
CREATE UNIQUE INDEX IF NOT EXISTS pose_template_items_template_pose_key
  ON public.pose_template_items(template_id, pose_key);

COMMENT ON TABLE public.pose_division_templates IS 'Contest divisions with category (mens/womens). Used to drive mandatory pose lists.';
COMMENT ON TABLE public.pose_template_items IS 'Pose definitions per division: pose_key, label, group, sort order, mandatory flag.';

-- 3) contest_preps: add normalized division_key (keep existing division text for display/free text)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contest_preps' AND column_name = 'division_key'
  ) THEN
    ALTER TABLE public.contest_preps ADD COLUMN division_key TEXT;
    COMMENT ON COLUMN public.contest_preps.division_key IS 'Normalized key referencing pose_division_templates.division_key. division remains for display.';
  END IF;
END $$;

-- 4) Seed division templates
INSERT INTO public.pose_division_templates (division_key, division_name, category) VALUES
  ('mens_open_bodybuilding', 'Mens Open Bodybuilding', 'mens'),
  ('classic_physique', 'Classic Physique', 'mens'),
  ('mens_physique', 'Mens Physique', 'mens'),
  ('womens_bodybuilding', 'Womens Bodybuilding', 'womens'),
  ('womens_physique', 'Womens Physique', 'womens'),
  ('figure', 'Figure', 'womens'),
  ('bikini', 'Bikini', 'womens')
ON CONFLICT (division_key) DO NOTHING;

-- 5) Seed pose_template_items per division (using template_id from division_key)
-- Helper: we insert by division_key via a CTE.

-- Mens Open Bodybuilding
INSERT INTO public.pose_template_items (template_id, pose_key, pose_label, pose_group, sort_order, is_mandatory)
SELECT id, v.pose_key, v.pose_label, v.pose_group, v.sort_order, true
FROM public.pose_division_templates t,
LATERAL (VALUES
  ('quarter_turn_front', 'Quarter turn front', 'quarter_turns', 1),
  ('quarter_turn_right', 'Quarter turn right', 'quarter_turns', 2),
  ('quarter_turn_back', 'Quarter turn back', 'quarter_turns', 3),
  ('quarter_turn_left', 'Quarter turn left', 'quarter_turns', 4),
  ('front_double_biceps', 'Front double biceps', 'front', 5),
  ('front_lat_spread', 'Front lat spread', 'front', 6),
  ('side_chest', 'Side chest', 'side', 7),
  ('side_triceps', 'Side triceps', 'side', 8),
  ('rear_double_biceps', 'Rear double biceps', 'back', 9),
  ('rear_lat_spread', 'Rear lat spread', 'back', 10),
  ('abdominals_and_thighs', 'Abdominals and thighs', 'abdominals', 11),
  ('most_muscular', 'Most muscular', 'most_muscular', 12)
) AS v(pose_key, pose_label, pose_group, sort_order)
WHERE t.division_key = 'mens_open_bodybuilding'
ON CONFLICT (template_id, pose_key) DO NOTHING;

-- Classic Physique
INSERT INTO public.pose_template_items (template_id, pose_key, pose_label, pose_group, sort_order, is_mandatory)
SELECT id, v.pose_key, v.pose_label, v.pose_group, v.sort_order, true
FROM public.pose_division_templates t,
LATERAL (VALUES
  ('quarter_turn_front', 'Quarter turn front', 'quarter_turns', 1),
  ('quarter_turn_right', 'Quarter turn right', 'quarter_turns', 2),
  ('quarter_turn_back', 'Quarter turn back', 'quarter_turns', 3),
  ('quarter_turn_left', 'Quarter turn left', 'quarter_turns', 4),
  ('front_double_biceps', 'Front double biceps', 'front', 5),
  ('side_chest', 'Side chest', 'side', 6),
  ('back_double_biceps', 'Back double biceps', 'back', 7),
  ('abdominals_and_thighs', 'Abdominals and thighs', 'abdominals', 8),
  ('favourite_classic_pose', 'Favourite classic pose', 'favourite', 9)
) AS v(pose_key, pose_label, pose_group, sort_order)
WHERE t.division_key = 'classic_physique'
ON CONFLICT (template_id, pose_key) DO NOTHING;

-- Mens Physique
INSERT INTO public.pose_template_items (template_id, pose_key, pose_label, pose_group, sort_order, is_mandatory)
SELECT id, v.pose_key, v.pose_label, v.pose_group, v.sort_order, true
FROM public.pose_division_templates t,
LATERAL (VALUES
  ('quarter_turn_front', 'Quarter turn front', 'quarter_turns', 1),
  ('quarter_turn_right', 'Quarter turn right', 'quarter_turns', 2),
  ('quarter_turn_back', 'Quarter turn back', 'quarter_turns', 3),
  ('quarter_turn_left', 'Quarter turn left', 'quarter_turns', 4),
  ('front_pose', 'Front pose', 'front', 5),
  ('back_pose', 'Back pose', 'back', 6)
) AS v(pose_key, pose_label, pose_group, sort_order)
WHERE t.division_key = 'mens_physique'
ON CONFLICT (template_id, pose_key) DO NOTHING;

-- Womens Bodybuilding
INSERT INTO public.pose_template_items (template_id, pose_key, pose_label, pose_group, sort_order, is_mandatory)
SELECT id, v.pose_key, v.pose_label, v.pose_group, v.sort_order, true
FROM public.pose_division_templates t,
LATERAL (VALUES
  ('quarter_turn_front', 'Quarter turn front', 'quarter_turns', 1),
  ('quarter_turn_right', 'Quarter turn right', 'quarter_turns', 2),
  ('quarter_turn_back', 'Quarter turn back', 'quarter_turns', 3),
  ('quarter_turn_left', 'Quarter turn left', 'quarter_turns', 4),
  ('front_double_biceps', 'Front double biceps', 'front', 5),
  ('front_lat_spread', 'Front lat spread', 'front', 6),
  ('side_chest', 'Side chest', 'side', 7),
  ('side_triceps', 'Side triceps', 'side', 8),
  ('rear_double_biceps', 'Rear double biceps', 'back', 9),
  ('rear_lat_spread', 'Rear lat spread', 'back', 10),
  ('abdominals_and_thighs', 'Abdominals and thighs', 'abdominals', 11),
  ('most_muscular', 'Most muscular', 'most_muscular', 12)
) AS v(pose_key, pose_label, pose_group, sort_order)
WHERE t.division_key = 'womens_bodybuilding'
ON CONFLICT (template_id, pose_key) DO NOTHING;

-- Womens Physique
INSERT INTO public.pose_template_items (template_id, pose_key, pose_label, pose_group, sort_order, is_mandatory)
SELECT id, v.pose_key, v.pose_label, v.pose_group, v.sort_order, true
FROM public.pose_division_templates t,
LATERAL (VALUES
  ('quarter_turn_front', 'Quarter turn front', 'quarter_turns', 1),
  ('quarter_turn_right', 'Quarter turn right', 'quarter_turns', 2),
  ('quarter_turn_back', 'Quarter turn back', 'quarter_turns', 3),
  ('quarter_turn_left', 'Quarter turn left', 'quarter_turns', 4),
  ('front_double_biceps', 'Front double biceps', 'front', 5),
  ('side_chest', 'Side chest', 'side', 6),
  ('back_double_biceps', 'Back double biceps', 'back', 7),
  ('side_triceps', 'Side triceps', 'side', 8),
  ('abdominals_and_thighs', 'Abdominals and thighs', 'abdominals', 9)
) AS v(pose_key, pose_label, pose_group, sort_order)
WHERE t.division_key = 'womens_physique'
ON CONFLICT (template_id, pose_key) DO NOTHING;

-- Figure
INSERT INTO public.pose_template_items (template_id, pose_key, pose_label, pose_group, sort_order, is_mandatory)
SELECT id, v.pose_key, v.pose_label, v.pose_group, v.sort_order, true
FROM public.pose_division_templates t,
LATERAL (VALUES
  ('front_pose', 'Front pose', 'front', 1),
  ('quarter_turn_right', 'Quarter turn right', 'quarter_turns', 2),
  ('back_pose', 'Back pose', 'back', 3),
  ('quarter_turn_left', 'Quarter turn left', 'quarter_turns', 4)
) AS v(pose_key, pose_label, pose_group, sort_order)
WHERE t.division_key = 'figure'
ON CONFLICT (template_id, pose_key) DO NOTHING;

-- Bikini
INSERT INTO public.pose_template_items (template_id, pose_key, pose_label, pose_group, sort_order, is_mandatory)
SELECT id, v.pose_key, v.pose_label, v.pose_group, v.sort_order, true
FROM public.pose_division_templates t,
LATERAL (VALUES
  ('front_pose', 'Front pose', 'front', 1),
  ('quarter_turn_right', 'Quarter turn right', 'quarter_turns', 2),
  ('back_pose', 'Back pose', 'back', 3),
  ('quarter_turn_left', 'Quarter turn left', 'quarter_turns', 4)
) AS v(pose_key, pose_label, pose_group, sort_order)
WHERE t.division_key = 'bikini'
ON CONFLICT (template_id, pose_key) DO NOTHING;
