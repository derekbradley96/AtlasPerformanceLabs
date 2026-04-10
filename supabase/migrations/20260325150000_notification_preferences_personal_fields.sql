-- Personal-friendly notification categories.

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS workouts BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS nutrition BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS progress_reminders BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.notification_preferences.workouts IS 'Workout reminder notifications.';
COMMENT ON COLUMN public.notification_preferences.nutrition IS 'Nutrition reminder notifications.';
COMMENT ON COLUMN public.notification_preferences.progress_reminders IS 'Progress reminder notifications.';
