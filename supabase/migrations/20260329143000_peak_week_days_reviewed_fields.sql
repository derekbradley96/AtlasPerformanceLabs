-- Coach review markers for peak week day rows.

ALTER TABLE public.peak_week_days
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE public.peak_week_days
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS peak_week_days_reviewed_at_idx
  ON public.peak_week_days(reviewed_at DESC);
