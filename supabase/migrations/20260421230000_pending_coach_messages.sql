-- Pending coach message drafts (payment / check-in / adherence) for coach review before sending.

CREATE TABLE IF NOT EXISTS public.pending_coach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL,
  draft_message TEXT NOT NULL,
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pending_coach_messages_trigger_type_check CHECK (
    trigger_type IN ('payment_overdue', 'missed_checkin', 'low_adherence')
  )
);

CREATE INDEX IF NOT EXISTS pending_coach_messages_coach_open_idx
  ON public.pending_coach_messages (coach_id, created_at DESC)
  WHERE dismissed_at IS NULL AND approved_at IS NULL;

CREATE INDEX IF NOT EXISTS pending_coach_messages_client_trigger_idx
  ON public.pending_coach_messages (client_id, trigger_type, created_at DESC);

COMMENT ON TABLE public.pending_coach_messages IS 'Warm draft messages for coach approval (cron-generated); coach sends via messaging after review.';

ALTER TABLE public.pending_coach_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pending_coach_messages_select_coach ON public.pending_coach_messages;
DROP POLICY IF EXISTS pending_coach_messages_insert_coach ON public.pending_coach_messages;
DROP POLICY IF EXISTS pending_coach_messages_update_coach ON public.pending_coach_messages;
DROP POLICY IF EXISTS pending_coach_messages_delete_coach ON public.pending_coach_messages;

CREATE POLICY pending_coach_messages_select_coach ON public.pending_coach_messages
  FOR SELECT USING (coach_id = auth.uid());

CREATE POLICY pending_coach_messages_insert_coach ON public.pending_coach_messages
  FOR INSERT WITH CHECK (coach_id = auth.uid());

CREATE POLICY pending_coach_messages_update_coach ON public.pending_coach_messages
  FOR UPDATE USING (coach_id = auth.uid());

CREATE POLICY pending_coach_messages_delete_coach ON public.pending_coach_messages
  FOR DELETE USING (coach_id = auth.uid());

-- Allow coach-facing automation notification types
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'checkin_due',
    'checkin_review',
    'checkin_overdue',
    'checkin_submitted',
    'message_received',
    'message_reply',
    'habit_due',
    'habit_streak',
    'peak_week_update',
    'program_update',
    'payment_due',
    'payment_issue',
    'billing_failed',
    'at_risk_client',
    'client_flag_created',
    'pose_check_submitted',
    'adherence_drop',
    'inactivity',
    'review_summary',
    'retention_nudge',
    'automation',
    'payment_reminder_auto',
    'coach_pending_draft'
  )
);
