-- Per-user display preferences for height/weight. Canonical storage: height in cm (e.g. personal.height_cm),
-- weight on profiles.current_weight / profiles.target_weight as kg after backfill.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS height_unit TEXT,
  ADD COLUMN IF NOT EXISTS weight_unit TEXT;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_height_unit_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_height_unit_check
  CHECK (height_unit IS NULL OR height_unit IN ('cm', 'ft_in', 'm'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_weight_unit_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_weight_unit_check
  CHECK (weight_unit IS NULL OR weight_unit IN ('kg', 'st_lb', 'lb'));

COMMENT ON COLUMN public.profiles.height_unit IS 'Display preference: cm | ft_in | m.';
COMMENT ON COLUMN public.profiles.weight_unit IS 'Display preference: kg | st_lb | lb.';
COMMENT ON COLUMN public.profiles.current_weight IS 'Current body weight, canonical kg (after 20260402143000 migration).';
COMMENT ON COLUMN public.profiles.target_weight IS 'Target body weight, canonical kg (after 20260402143000 migration).';

-- Seed weight_unit from legacy profiles.units (values were stored in that unit).
UPDATE public.profiles
SET weight_unit = CASE
  WHEN lower(trim(coalesce(units, 'kg'))) IN ('lb', 'lbs', 'imperial') THEN 'lb'
  ELSE 'kg'
END
WHERE weight_unit IS NULL;

-- Convert profile weights from lb to kg where legacy unit was imperial.
UPDATE public.profiles
SET
  current_weight = CASE
    WHEN lower(trim(coalesce(units, 'kg'))) IN ('lb', 'lbs', 'imperial')
      AND current_weight IS NOT NULL
    THEN round((current_weight * 0.45359237)::numeric, 3)
    ELSE current_weight
  END,
  target_weight = CASE
    WHEN lower(trim(coalesce(units, 'kg'))) IN ('lb', 'lbs', 'imperial')
      AND target_weight IS NOT NULL
    THEN round((target_weight * 0.45359237)::numeric, 3)
    ELSE target_weight
  END;

-- Legacy units column now aligns with kg canonical weights.
UPDATE public.profiles SET units = 'kg' WHERE units IS NOT NULL;

UPDATE public.profiles SET height_unit = 'cm' WHERE height_unit IS NULL;
UPDATE public.profiles SET weight_unit = 'kg' WHERE weight_unit IS NULL;
