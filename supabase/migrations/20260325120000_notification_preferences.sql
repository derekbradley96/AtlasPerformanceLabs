-- Per-profile notification preferences (checkins, messages, habits, peak_week, payments).
-- One row per profile; defaults allow all. Used by send-reminders and push logic to respect opt-out.

CREATE TABLE public.notification_preferences (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  checkins BOOLEAN NOT NULL DEFAULT true,
  messages BOOLEAN NOT NULL DEFAULT true,
  habits BOOLEAN NOT NULL DEFAULT true,
  peak_week BOOLEAN NOT NULL DEFAULT true,
  payments BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notification_preferences IS 'User preferences for notification types; false = do not send.';
COMMENT ON COLUMN public.notification_preferences.checkins IS 'Check-in due / review notifications.';
COMMENT ON COLUMN public.notification_preferences.messages IS 'New message notifications.';
COMMENT ON COLUMN public.notification_preferences.habits IS 'Habit reminder notifications.';
COMMENT ON COLUMN public.notification_preferences.peak_week IS 'Peak week update / day instructions.';
COMMENT ON COLUMN public.notification_preferences.payments IS 'Payment due / overdue notifications.';

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_preferences_select_own ON public.notification_preferences
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY notification_preferences_insert_own ON public.notification_preferences
  FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY notification_preferences_update_own ON public.notification_preferences
  FOR UPDATE USING (profile_id = auth.uid());
