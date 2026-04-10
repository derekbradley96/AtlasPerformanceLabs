-- Track what plan snapshot the client last saw for a peak week day.

ALTER TABLE public.peak_week_day_status
  ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ;

ALTER TABLE public.peak_week_day_status
  ADD COLUMN IF NOT EXISTS last_viewed_plan_snapshot JSONB;

CREATE INDEX IF NOT EXISTS idx_peak_week_day_status_last_viewed_at
  ON public.peak_week_day_status(last_viewed_at DESC);

COMMENT ON COLUMN public.peak_week_day_status.last_viewed_at IS
'When the client last viewed this day plan.';

COMMENT ON COLUMN public.peak_week_day_status.last_viewed_plan_snapshot IS
'JSON snapshot of key day fields when client last viewed plan.';
