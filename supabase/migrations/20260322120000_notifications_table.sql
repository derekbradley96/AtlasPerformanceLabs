-- Notification system for all roles.
-- Replaces/extends any existing notifications table with canonical schema: profile_id, type enum, data jsonb.

DROP TABLE IF EXISTS public.notifications CASCADE;

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notifications_type_check CHECK (
    type IN (
      'checkin_due',
      'checkin_review',
      'message_received',
      'habit_due',
      'habit_streak',
      'peak_week_update',
      'program_update',
      'payment_due'
    )
  )
);

CREATE INDEX notifications_profile_idx ON public.notifications(profile_id);

COMMENT ON TABLE public.notifications IS 'In-app notifications per profile; works for all roles.';
COMMENT ON COLUMN public.notifications.type IS 'checkin_due | checkin_review | message_received | habit_due | habit_streak | peak_week_update | program_update | payment_due';
COMMENT ON COLUMN public.notifications.data IS 'Optional payload (e.g. client_id, thread_id) for deep links.';

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY notifications_insert_own ON public.notifications
  FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE USING (profile_id = auth.uid());

CREATE POLICY notifications_delete_own ON public.notifications
  FOR DELETE USING (profile_id = auth.uid());
