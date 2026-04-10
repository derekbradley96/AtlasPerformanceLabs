-- Peak week daily control schema extension.
-- Aligns public.peak_week_days to support full coach-driven daily prep instructions.

-- 1) Ensure table exists with canonical key columns.
CREATE TABLE IF NOT EXISTS public.peak_week_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  peak_week_id UUID NOT NULL REFERENCES public.peak_weeks(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL
);

-- 2) Ensure required columns exist.
ALTER TABLE public.peak_week_days
  ADD COLUMN IF NOT EXISTS day_label TEXT,
  ADD COLUMN IF NOT EXISTS target_date DATE,
  ADD COLUMN IF NOT EXISTS carbs_g INTEGER,
  ADD COLUMN IF NOT EXISTS protein_g INTEGER,
  ADD COLUMN IF NOT EXISTS fats_g INTEGER,
  ADD COLUMN IF NOT EXISTS water_l NUMERIC,
  ADD COLUMN IF NOT EXISTS sodium_mg INTEGER,
  ADD COLUMN IF NOT EXISTS steps_target INTEGER,
  ADD COLUMN IF NOT EXISTS cardio_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS training_type TEXT,
  ADD COLUMN IF NOT EXISTS training_notes TEXT,
  ADD COLUMN IF NOT EXISTS posing_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS posing_notes TEXT,
  ADD COLUMN IF NOT EXISTS morning_checkin_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS evening_checkin_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 3) Keep backward compatibility with any older single check-in flag.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'peak_week_days'
      AND column_name = 'checkin_required'
  ) THEN
    UPDATE public.peak_week_days
    SET
      morning_checkin_required = COALESCE(morning_checkin_required, checkin_required),
      evening_checkin_required = COALESCE(evening_checkin_required, checkin_required)
    WHERE checkin_required IS NOT NULL;
  END IF;
END $$;

-- 4) Enforce training_type allowed values.
ALTER TABLE public.peak_week_days
  DROP CONSTRAINT IF EXISTS peak_week_days_training_type_check;

ALTER TABLE public.peak_week_days
  ADD CONSTRAINT peak_week_days_training_type_check
  CHECK (
    training_type IS NULL
    OR training_type IN ('depletion', 'pump', 'rest', 'posing_only', 'custom')
  );

-- 5) Ensure unique constraint (peak_week_id, day_number).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'peak_week_days_peak_week_day_unique'
      AND conrelid = 'public.peak_week_days'::regclass
  ) THEN
    ALTER TABLE public.peak_week_days
      ADD CONSTRAINT peak_week_days_peak_week_day_unique UNIQUE (peak_week_id, day_number);
  END IF;
END $$;

-- 6) Useful indexes.
CREATE INDEX IF NOT EXISTS peak_week_days_peak_week_id_idx
  ON public.peak_week_days(peak_week_id);

CREATE INDEX IF NOT EXISTS peak_week_days_target_date_idx
  ON public.peak_week_days(target_date);

CREATE INDEX IF NOT EXISTS peak_week_days_peak_week_target_date_idx
  ON public.peak_week_days(peak_week_id, target_date);

CREATE INDEX IF NOT EXISTS peak_week_days_training_type_idx
  ON public.peak_week_days(training_type)
  WHERE training_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS peak_week_days_updated_at_idx
  ON public.peak_week_days(updated_at DESC);

-- 7) Keep updated_at current via trigger.
CREATE OR REPLACE FUNCTION public.set_peak_week_days_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_peak_week_days_set_updated_at ON public.peak_week_days;
CREATE TRIGGER trg_peak_week_days_set_updated_at
BEFORE UPDATE ON public.peak_week_days
FOR EACH ROW
EXECUTE FUNCTION public.set_peak_week_days_updated_at();

COMMENT ON TABLE public.peak_week_days IS
'Peak week per-day control rows: macros, hydration, sodium, training, posing, check-ins, and coach notes.';
