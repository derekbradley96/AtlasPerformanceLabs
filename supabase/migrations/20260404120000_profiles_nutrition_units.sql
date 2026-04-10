-- Nutrition display preferences (independent of body metrics and training load_unit).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS food_quantity_unit TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nutrition_label_display TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS water_unit TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sodium_unit TEXT;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_food_quantity_unit_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_food_quantity_unit_check
  CHECK (food_quantity_unit IS NULL OR food_quantity_unit IN ('g_ml', 'oz_fl_oz', 'household'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_nutrition_label_display_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_nutrition_label_display_check
  CHECK (nutrition_label_display IS NULL OR nutrition_label_display IN ('per_100g', 'per_serving'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_water_unit_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_water_unit_check
  CHECK (water_unit IS NULL OR water_unit IN ('ml', 'litres', 'fl_oz'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_sodium_unit_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_sodium_unit_check
  CHECK (sodium_unit IS NULL OR sodium_unit IN ('mg', 'g'));

COMMENT ON COLUMN public.profiles.food_quantity_unit IS 'Nutrition only: g_ml | oz_fl_oz | household.';
COMMENT ON COLUMN public.profiles.nutrition_label_display IS 'Packaged food default: per_100g | per_serving.';
COMMENT ON COLUMN public.profiles.water_unit IS 'Hydration display: ml | litres | fl_oz.';
COMMENT ON COLUMN public.profiles.sodium_unit IS 'Sodium display: mg | g.';
