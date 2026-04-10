-- Smart notifications: category (action_required | engagement | insights), entity_id, expanded types,
-- and SECURITY DEFINER RPC so coach↔client notifications work under RLS.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'engagement';

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS entity_id UUID;

COMMENT ON COLUMN public.notifications.message IS 'Display body (same role as API "body").';
COMMENT ON COLUMN public.notifications.category IS 'action_required | engagement | insights — drives UI sections and push cadence.';
COMMENT ON COLUMN public.notifications.entity_id IS 'Optional primary entity (client, check-in, thread, etc.) for deep links.';

-- Backfill category from legacy type
UPDATE public.notifications
SET category = CASE type
  WHEN 'checkin_review' THEN 'action_required'
  WHEN 'checkin_due' THEN 'action_required'
  WHEN 'payment_due' THEN 'action_required'
  WHEN 'program_update' THEN 'action_required'
  WHEN 'message_received' THEN 'engagement'
  WHEN 'habit_due' THEN 'engagement'
  WHEN 'habit_streak' THEN 'engagement'
  WHEN 'peak_week_update' THEN 'engagement'
  WHEN 'adherence_drop' THEN 'insights'
  WHEN 'inactivity' THEN 'insights'
  WHEN 'review_summary' THEN 'insights'
  WHEN 'retention_nudge' THEN 'insights'
  ELSE 'engagement'
END;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'checkin_due',
    'checkin_review',
    'checkin_overdue',
    'message_received',
    'message_reply',
    'habit_due',
    'habit_streak',
    'peak_week_update',
    'program_update',
    'payment_due',
    'payment_issue',
    'at_risk_client',
    'adherence_drop',
    'inactivity',
    'review_summary',
    'retention_nudge'
  )
);

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_category_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_category_check CHECK (
  category IN ('action_required', 'engagement', 'insights')
);

CREATE INDEX IF NOT EXISTS notifications_profile_category_created_idx
  ON public.notifications (profile_id, category, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_profile_unread_idx
  ON public.notifications (profile_id, is_read)
  WHERE is_read = false;

-- ---------------------------------------------------------------------------
-- insert_notification_for_recipient: allows cross-user inserts when relationship exists
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.insert_notification_for_recipient(
  p_recipient_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT '{}',
  p_category TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_cat TEXT;
  v_allowed BOOLEAN := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_recipient_id IS NULL OR length(trim(p_type)) = 0 OR length(trim(p_title)) = 0 OR length(trim(p_message)) = 0 THEN
    RAISE EXCEPTION 'invalid arguments';
  END IF;

  v_cat := NULLIF(trim(p_category), '');
  IF v_cat IS NULL THEN
    v_cat := CASE trim(p_type)
      WHEN 'checkin_review' THEN 'action_required'
      WHEN 'checkin_due' THEN 'action_required'
      WHEN 'checkin_overdue' THEN 'action_required'
      WHEN 'payment_due' THEN 'action_required'
      WHEN 'payment_issue' THEN 'action_required'
      WHEN 'at_risk_client' THEN 'action_required'
      WHEN 'program_update' THEN 'action_required'
      WHEN 'message_received' THEN 'engagement'
      WHEN 'message_reply' THEN 'engagement'
      WHEN 'habit_due' THEN 'engagement'
      WHEN 'habit_streak' THEN 'engagement'
      WHEN 'peak_week_update' THEN 'engagement'
      WHEN 'adherence_drop' THEN 'insights'
      WHEN 'inactivity' THEN 'insights'
      WHEN 'review_summary' THEN 'insights'
      WHEN 'retention_nudge' THEN 'insights'
      ELSE 'engagement'
    END;
  END IF;

  IF p_recipient_id = auth.uid() THEN
    v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    IF EXISTS (
      SELECT 1
      FROM public.message_threads mt
      INNER JOIN public.clients c ON c.id = mt.client_id
      WHERE mt.deleted_at IS NULL
        AND (
          (mt.coach_id = auth.uid() AND c.user_id IS NOT NULL AND c.user_id = p_recipient_id)
          OR (mt.coach_id = p_recipient_id AND c.user_id = auth.uid())
        )
    ) THEN
      v_allowed := true;
    END IF;
  END IF;

  IF NOT v_allowed THEN
    IF EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.user_id IS NOT NULL
        AND (
          (c.user_id = auth.uid() AND (c.coach_id = p_recipient_id OR c.trainer_id = p_recipient_id OR c.assigned_coach_id = p_recipient_id))
          OR (c.user_id = p_recipient_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid() OR c.assigned_coach_id = auth.uid()))
        )
    ) THEN
      v_allowed := true;
    END IF;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'not authorized to notify this user';
  END IF;

  INSERT INTO public.notifications (
    profile_id,
    type,
    title,
    message,
    data,
    is_read,
    category,
    entity_id
  )
  VALUES (
    p_recipient_id,
    trim(p_type),
    trim(p_title),
    trim(p_message),
    COALESCE(p_data, '{}'::jsonb),
    false,
    v_cat,
    p_entity_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.insert_notification_for_recipient IS
  'Insert a notification for another profile when caller is self, messaging peer, or linked coach/client.';

REVOKE ALL ON FUNCTION public.insert_notification_for_recipient(UUID, TEXT, TEXT, TEXT, JSONB, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_notification_for_recipient(UUID, TEXT, TEXT, TEXT, JSONB, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_notification_for_recipient(UUID, TEXT, TEXT, TEXT, JSONB, TEXT, UUID) TO service_role;
