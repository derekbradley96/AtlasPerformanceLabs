-- Personal nutrition targets (calories + macros) stored on profiles; RLS already allows own-row UPDATE.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS calories_target integer,
  ADD COLUMN IF NOT EXISTS protein_target integer,
  ADD COLUMN IF NOT EXISTS carbs_target integer,
  ADD COLUMN IF NOT EXISTS fats_target integer;

COMMENT ON COLUMN public.profiles.calories_target IS 'Daily calorie target for personal/solo nutrition.';
COMMENT ON COLUMN public.profiles.protein_target IS 'Daily protein target (grams) for personal/solo nutrition.';
COMMENT ON COLUMN public.profiles.carbs_target IS 'Daily carbs target (grams) for personal/solo nutrition.';
COMMENT ON COLUMN public.profiles.fats_target IS 'Daily fats target (grams) for personal/solo nutrition.';
