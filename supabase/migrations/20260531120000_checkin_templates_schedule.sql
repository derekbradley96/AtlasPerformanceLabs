-- Add scheduling fields to checkin_templates so coaches can
-- set a day + time for automatic client check-in reminders.

CREATE TABLE IF NOT EXISTS public.checkin_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NULL,
  coach_id UUID NULL,
  name TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL DEFAULT 'weekly',
  is_active BOOLEAN NOT NULL DEFAULT true,
  include_bodyweight BOOLEAN NOT NULL DEFAULT true,
  include_photos BOOLEAN NOT NULL DEFAULT true,
  include_energy BOOLEAN NOT NULL DEFAULT true,
  include_mood BOOLEAN NOT NULL DEFAULT true,
  include_sleep BOOLEAN NOT NULL DEFAULT true,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  response_templates JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.checkin_templates
  ADD COLUMN IF NOT EXISTS schedule_day_of_week INTEGER
    CHECK (schedule_day_of_week BETWEEN 0 AND 6);
  -- 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday,
  -- 4=Thursday, 5=Friday, 6=Saturday

ALTER TABLE public.checkin_templates
  ADD COLUMN IF NOT EXISTS schedule_time TIME
    DEFAULT '09:00:00';
  -- Time in UTC - convert from coach's local time in UI

ALTER TABLE public.checkin_templates
  ADD COLUMN IF NOT EXISTS reminder_advance_minutes INTEGER
    DEFAULT 60;
  -- How many minutes before schedule_time to send reminder
  -- Default: 60 minutes (1 hour before)

COMMENT ON COLUMN public.checkin_templates.schedule_day_of_week IS
  '0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat. NULL = not scheduled.';
COMMENT ON COLUMN public.checkin_templates.schedule_time IS
  'Time of day (UTC) when check-in opens for clients.';
COMMENT ON COLUMN public.checkin_templates.reminder_advance_minutes IS
  'Minutes before schedule_time to send push notification.';
