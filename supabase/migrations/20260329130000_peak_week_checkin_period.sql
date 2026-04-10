-- Support morning/evening peak week check-ins.

ALTER TABLE public.peak_week_checkins
  ADD COLUMN IF NOT EXISTS checkin_period TEXT;

UPDATE public.peak_week_checkins
SET checkin_period = COALESCE(checkin_period, 'evening')
WHERE checkin_period IS NULL;

ALTER TABLE public.peak_week_checkins
  ALTER COLUMN checkin_period SET DEFAULT 'evening';

ALTER TABLE public.peak_week_checkins
  ALTER COLUMN checkin_period SET NOT NULL;

ALTER TABLE public.peak_week_checkins
  DROP CONSTRAINT IF EXISTS peak_week_checkins_checkin_period_check;

ALTER TABLE public.peak_week_checkins
  ADD CONSTRAINT peak_week_checkins_checkin_period_check
  CHECK (checkin_period IN ('morning', 'evening'));

CREATE INDEX IF NOT EXISTS peak_week_checkins_period_created_idx
  ON public.peak_week_checkins(checkin_period, created_at DESC);

CREATE INDEX IF NOT EXISTS peak_week_checkins_client_period_created_idx
  ON public.peak_week_checkins(client_id, checkin_period, created_at DESC);
