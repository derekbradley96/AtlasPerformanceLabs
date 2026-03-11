-- Notify coaches when important events occur: check-in submitted, pose check submitted,
-- client flag created, billing failed (client billing_status -> overdue).

CREATE OR REPLACE FUNCTION public.insert_coach_notification(
  p_coach_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_coach_id IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.notifications (user_id, type, title, message, is_read)
  VALUES (p_coach_id, p_type, p_title, p_message, false);
END;
$$;

-- Resolve coach_id from clients row
CREATE OR REPLACE FUNCTION public.clients_coach_id(p_client_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(c.coach_id, c.trainer_id) FROM public.clients c WHERE c.id = p_client_id LIMIT 1;
$$;

-- 1) checkin_submitted
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
    COALESCE(v_client_name, 'A client') || ' submitted a check-in.'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_coach_checkin_submitted ON public.checkins;
CREATE TRIGGER trg_notify_coach_checkin_submitted
  AFTER INSERT ON public.checkins
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_coach_checkin_submitted();

-- 2) pose_check_submitted
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
    COALESCE(v_client_name, 'A client') || ' submitted a pose check.'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_coach_pose_check_submitted ON public.pose_checks;
CREATE TRIGGER trg_notify_coach_pose_check_submitted
  AFTER INSERT ON public.pose_checks
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_coach_pose_check_submitted();

-- 3) client_flag_created (new unresolved flag only)
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
    'client_flag_created',
    'Client flag created',
    COALESCE(v_client_name, 'A client') || ' has a new flag'
      || CASE WHEN NEW.label IS NOT NULL AND trim(NEW.label) <> '' THEN ': ' || trim(NEW.label) ELSE '' END
      || '.'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_coach_client_flag_created ON public.client_flags;
CREATE TRIGGER trg_notify_coach_client_flag_created
  AFTER INSERT ON public.client_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_coach_client_flag_created();

-- 4) billing_failed: client billing_status becomes overdue
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
    'billing_failed',
    'Billing failed',
    COALESCE(v_client_name, 'A client') || '''s payment is overdue.'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_coach_billing_failed ON public.clients;
CREATE TRIGGER trg_notify_coach_billing_failed
  AFTER UPDATE OF billing_status ON public.clients
  FOR EACH ROW
  WHEN (NEW.billing_status = 'overdue' AND (OLD.billing_status IS DISTINCT FROM NEW.billing_status))
  EXECUTE FUNCTION public.trg_notify_coach_billing_failed();

COMMENT ON FUNCTION public.insert_coach_notification IS 'Insert a notification row for a coach (bypasses RLS). Used by event triggers.';
