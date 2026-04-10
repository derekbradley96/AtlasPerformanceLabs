-- Align DB coach triggers with notifications table (profile_id, data JSONB, category, entity_id).
-- Canonical types: checkin_submitted, pose_check_submitted, at_risk_client, payment_issue, etc.

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
    'automation'
  )
);

CREATE OR REPLACE FUNCTION public.insert_coach_notification(
  p_coach_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT '{}'::jsonb,
  p_entity_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type TEXT := trim(p_type);
  v_cat TEXT;
BEGIN
  IF p_coach_id IS NULL OR length(v_type) = 0 THEN
    RETURN;
  END IF;

  v_cat := CASE v_type
    WHEN 'checkin_submitted' THEN 'action_required'
    WHEN 'checkin_review' THEN 'action_required'
    WHEN 'checkin_due' THEN 'action_required'
    WHEN 'checkin_overdue' THEN 'action_required'
    WHEN 'pose_check_submitted' THEN 'action_required'
    WHEN 'client_flag_created' THEN 'action_required'
    WHEN 'at_risk_client' THEN 'action_required'
    WHEN 'billing_failed' THEN 'action_required'
    WHEN 'payment_due' THEN 'action_required'
    WHEN 'payment_issue' THEN 'action_required'
    WHEN 'program_update' THEN 'action_required'
    ELSE 'engagement'
  END;

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
    p_coach_id,
    v_type,
    trim(p_title),
    trim(p_message),
    COALESCE(p_data, '{}'::jsonb),
    false,
    v_cat,
    p_entity_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_notify_coach_checkin_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coach_id UUID;
  v_client_name TEXT;
BEGIN
  v_coach_id := public.clients_coach_id(NEW.client_id);
  IF v_coach_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(NULLIF(trim(c.name), ''), 'Client') INTO v_client_name FROM public.clients c WHERE c.id = NEW.client_id LIMIT 1;
  PERFORM public.insert_coach_notification(
    v_coach_id,
    'checkin_submitted',
    'Check-in submitted',
    COALESCE(v_client_name, 'A client') || ' submitted a check-in.',
    jsonb_build_object('client_id', NEW.client_id, 'checkin_id', NEW.id),
    NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_notify_coach_pose_check_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coach_id UUID;
  v_client_name TEXT;
BEGIN
  v_coach_id := public.clients_coach_id(NEW.client_id);
  IF v_coach_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(NULLIF(trim(c.name), ''), 'Client') INTO v_client_name FROM public.clients c WHERE c.id = NEW.client_id LIMIT 1;
  PERFORM public.insert_coach_notification(
    v_coach_id,
    'pose_check_submitted',
    'Pose check submitted',
    COALESCE(v_client_name, 'A client') || ' submitted a pose check.',
    jsonb_build_object('client_id', NEW.client_id, 'pose_check_id', NEW.id),
    NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_notify_coach_client_flag_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coach_id UUID;
  v_client_name TEXT;
BEGIN
  IF NEW.resolved_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  v_coach_id := public.clients_coach_id(NEW.client_id);
  IF v_coach_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(NULLIF(trim(c.name), ''), 'Client') INTO v_client_name FROM public.clients c WHERE c.id = NEW.client_id LIMIT 1;
  PERFORM public.insert_coach_notification(
    v_coach_id,
    'at_risk_client',
    'Client needs attention',
    COALESCE(v_client_name, 'A client') || ' has a new flag'
      || CASE WHEN NEW.label IS NOT NULL AND trim(NEW.label) <> '' THEN ': ' || trim(NEW.label) ELSE '' END
      || '.',
    jsonb_build_object('client_id', NEW.client_id, 'flag_id', NEW.id),
    NEW.client_id
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_notify_coach_billing_failed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coach_id UUID;
  v_client_name TEXT;
BEGIN
  IF NEW.billing_status IS DISTINCT FROM 'overdue' THEN
    RETURN NEW;
  END IF;
  IF OLD.billing_status = 'overdue' THEN
    RETURN NEW;
  END IF;
  v_coach_id := COALESCE(NEW.coach_id, NEW.trainer_id);
  IF v_coach_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(NEW.full_name, NEW.name, 'Client') INTO v_client_name;
  PERFORM public.insert_coach_notification(
    v_coach_id,
    'payment_issue',
    'Payment issue',
    COALESCE(v_client_name, 'A client') || '''s payment is overdue.',
    jsonb_build_object('client_id', NEW.id),
    NEW.id
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.insert_coach_notification(UUID, TEXT, TEXT, TEXT, JSONB, UUID) IS
  'Insert a notification row for a coach (SECURITY DEFINER). Uses profile_id + category + entity_id.';

-- Extend RPC type → category map
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
      WHEN 'checkin_submitted' THEN 'action_required'
      WHEN 'pose_check_submitted' THEN 'action_required'
      WHEN 'client_flag_created' THEN 'action_required'
      WHEN 'at_risk_client' THEN 'action_required'
      WHEN 'payment_due' THEN 'action_required'
      WHEN 'payment_issue' THEN 'action_required'
      WHEN 'billing_failed' THEN 'action_required'
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
