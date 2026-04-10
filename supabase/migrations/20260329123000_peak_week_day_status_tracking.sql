-- Peak week day status tracking.
-- One status row per (peak_week_day_id, client_id).

CREATE TABLE IF NOT EXISTS public.peak_week_day_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  peak_week_day_id UUID NOT NULL REFERENCES public.peak_week_days(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  macros_completed BOOLEAN NOT NULL DEFAULT false,
  water_completed BOOLEAN NOT NULL DEFAULT false,
  cardio_completed BOOLEAN NOT NULL DEFAULT false,
  posing_completed BOOLEAN NOT NULL DEFAULT false,
  morning_checkin_completed BOOLEAN NOT NULL DEFAULT false,
  evening_checkin_completed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per client/day.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'peak_week_day_status_day_client_unique'
      AND conrelid = 'public.peak_week_day_status'::regclass
  ) THEN
    ALTER TABLE public.peak_week_day_status
      ADD CONSTRAINT peak_week_day_status_day_client_unique
      UNIQUE (peak_week_day_id, client_id);
  END IF;
END $$;

-- Useful indexes for client/day queries.
CREATE INDEX IF NOT EXISTS idx_peak_week_day_status_client_id
  ON public.peak_week_day_status(client_id);

CREATE INDEX IF NOT EXISTS idx_peak_week_day_status_peak_week_day_id
  ON public.peak_week_day_status(peak_week_day_id);

CREATE INDEX IF NOT EXISTS idx_peak_week_day_status_updated_at
  ON public.peak_week_day_status(updated_at DESC);

-- Keep updated_at fresh.
CREATE OR REPLACE FUNCTION public.set_peak_week_day_status_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_peak_week_day_status_set_updated_at ON public.peak_week_day_status;
CREATE TRIGGER trg_peak_week_day_status_set_updated_at
BEFORE UPDATE ON public.peak_week_day_status
FOR EACH ROW
EXECUTE FUNCTION public.set_peak_week_day_status_updated_at();

COMMENT ON TABLE public.peak_week_day_status IS
'Completion tracking per peak week day and client (macros, water, cardio, posing, morning/evening check-ins).';
