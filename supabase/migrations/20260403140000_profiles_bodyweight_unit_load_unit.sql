-- Split body-metric display prefs from training load display prefs.
-- bodyweight_unit: kg | st_lb | lb (height stays height_unit). Canonical bodyweight: kg.
-- load_unit: kg | lb only. Canonical training loads in workout_session_sets.weight_done: kg.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bodyweight_unit TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS load_unit TEXT;

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'weight_unit'
  ) THEN
    EXECUTE $u$
      UPDATE public.profiles
      SET bodyweight_unit = weight_unit
      WHERE (bodyweight_unit IS NULL OR btrim(bodyweight_unit::text) = '')
        AND weight_unit IS NOT NULL
        AND btrim(weight_unit::text) <> ''
    $u$;
  END IF;
END;
$migration$;

UPDATE public.profiles
SET bodyweight_unit = CASE
  WHEN lower(trim(coalesce(units, ''))) IN ('lb', 'lbs') THEN 'lb'
  ELSE 'kg'
END
WHERE bodyweight_unit IS NULL OR btrim(bodyweight_unit::text) = '';

UPDATE public.profiles
SET bodyweight_unit = 'kg'
WHERE bodyweight_unit IS NULL OR btrim(bodyweight_unit::text) = '';

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'weight_unit'
  ) THEN
    ALTER TABLE public.profiles DROP COLUMN weight_unit;
  END IF;
END;
$migration$;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_weight_unit_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_bodyweight_unit_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_bodyweight_unit_check
  CHECK (bodyweight_unit IS NULL OR bodyweight_unit IN ('kg', 'st_lb', 'lb'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_load_unit_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_load_unit_check
  CHECK (load_unit IS NULL OR load_unit IN ('kg', 'lb'));

COMMENT ON COLUMN public.profiles.bodyweight_unit IS 'Body metrics display: kg | st_lb | lb. Independent of load_unit.';
COMMENT ON COLUMN public.profiles.load_unit IS 'Training load display: kg | lb only. Never stones.';
