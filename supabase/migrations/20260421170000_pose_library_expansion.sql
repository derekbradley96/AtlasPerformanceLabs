-- Pose library expansion: wellness + fitness + wheelchair templates, optional federation notes on items,
-- and fill women's physique template to match women's bodybuilding mandatory set.

-- 1) Optional JSON notes per template line (e.g. federation-specific bullets from app seed)
ALTER TABLE public.pose_template_items
  ADD COLUMN IF NOT EXISTS federation_notes JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.pose_template_items.federation_notes IS 'Optional JSON map of federation key -> { bullets: string[] } for display; defaults empty.';

-- 2) New division templates
INSERT INTO public.pose_division_templates (division_key, division_name, category) VALUES
  ('wellness', 'Wellness', 'womens'),
  ('fitness', 'Fitness', 'womens'),
  ('wheelchair_open', 'Wheelchair Open', 'mens')
ON CONFLICT (division_key) DO NOTHING;

-- 3) Wellness — mirror bikini-style stage flow (front / quarter / back / walk)
INSERT INTO public.pose_template_items (template_id, pose_key, pose_label, pose_group, sort_order, is_mandatory)
SELECT t.id, v.pose_key, v.pose_label, v.pose_group, v.sort_order, true
FROM public.pose_division_templates t,
LATERAL (VALUES
  ('front_pose', 'Front pose', 'front', 1),
  ('quarter_turn_right', 'Quarter turn right', 'quarter_turns', 2),
  ('back_pose', 'Back pose', 'back', 3),
  ('quarter_turn_left', 'Quarter turn left', 'quarter_turns', 4),
  ('walking_turn', 'Walking turn', 'presentation', 5)
) AS v(pose_key, pose_label, pose_group, sort_order)
WHERE t.division_key = 'wellness'
ON CONFLICT (template_id, pose_key) DO NOTHING;

-- 4) Fitness — quarter turns + routine
INSERT INTO public.pose_template_items (template_id, pose_key, pose_label, pose_group, sort_order, is_mandatory)
SELECT t.id, v.pose_key, v.pose_label, v.pose_group, v.sort_order, true
FROM public.pose_division_templates t,
LATERAL (VALUES
  ('quarter_turn_front', 'Quarter turn front', 'quarter_turns', 1),
  ('quarter_turn_right', 'Quarter turn right', 'quarter_turns', 2),
  ('quarter_turn_back', 'Quarter turn back', 'quarter_turns', 3),
  ('quarter_turn_left', 'Quarter turn left', 'quarter_turns', 4),
  ('fitness_routine_mandatory', 'Fitness routine', 'routine', 5)
) AS v(pose_key, pose_label, pose_group, sort_order)
WHERE t.division_key = 'fitness'
ON CONFLICT (template_id, pose_key) DO NOTHING;

-- 5) Wheelchair Open — adaptive symmetry + seated most muscular
INSERT INTO public.pose_template_items (template_id, pose_key, pose_label, pose_group, sort_order, is_mandatory)
SELECT t.id, v.pose_key, v.pose_label, v.pose_group, v.sort_order, true
FROM public.pose_division_templates t,
LATERAL (VALUES
  ('front_symmetry', 'Front symmetry', 'front', 1),
  ('rear_symmetry', 'Rear symmetry', 'back', 2),
  ('side_symmetry', 'Side symmetry', 'side', 3),
  ('most_muscular_seated', 'Most muscular (seated)', 'most_muscular', 4)
) AS v(pose_key, pose_label, pose_group, sort_order)
WHERE t.division_key = 'wheelchair_open'
ON CONFLICT (template_id, pose_key) DO NOTHING;

-- 6) Women's physique — add missing rows so set matches women's bodybuilding mandatories (if absent)
INSERT INTO public.pose_template_items (template_id, pose_key, pose_label, pose_group, sort_order, is_mandatory)
SELECT t.id, v.pose_key, v.pose_label, v.pose_group, v.sort_order, true
FROM public.pose_division_templates t,
LATERAL (VALUES
  ('quarter_turn_front', 'Quarter turn front', 'quarter_turns', 1),
  ('quarter_turn_right', 'Quarter turn right', 'quarter_turns', 2),
  ('quarter_turn_back', 'Quarter turn back', 'quarter_turns', 3),
  ('quarter_turn_left', 'Quarter turn left', 'quarter_turns', 4),
  ('front_lat_spread', 'Front lat spread', 'front', 5),
  ('rear_lat_spread', 'Rear lat spread', 'back', 6),
  ('most_muscular', 'Most muscular', 'most_muscular', 7)
) AS v(pose_key, pose_label, pose_group, sort_order)
WHERE t.division_key = 'womens_physique'
ON CONFLICT (template_id, pose_key) DO NOTHING;
