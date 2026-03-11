-- client_state summary table and triggers. RLS: coach by coach_id, client by clients.user_id.

-- Drop existing client_state and its triggers so we can recreate with exact schema
DROP TRIGGER IF EXISTS trg_client_state_checkin ON public.checkins;
DROP TRIGGER IF EXISTS trg_client_state_compliance ON public.client_compliance;
DROP TRIGGER IF EXISTS trg_client_state_flags ON public.client_flags;
DROP TRIGGER IF EXISTS trg_client_state_message ON public.message_messages;
DROP TABLE IF EXISTS public.client_state CASCADE;

-- 1) Table public.client_state
CREATE TABLE public.client_state (
  client_id UUID PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  coach_id UUID,
  last_checkin_at TIMESTAMPTZ,
  last_checkin_week_start DATE,
  current_compliance NUMERIC,
  active_flags_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX client_state_coach_id_idx ON public.client_state(coach_id);
CREATE INDEX client_state_coach_last_checkin_idx ON public.client_state(coach_id, last_checkin_at DESC NULLS LAST);

-- 2) Backfill: one row per client, coach_id from clients.coach_id or clients.trainer_id
INSERT INTO public.client_state (client_id, coach_id)
SELECT c.id, COALESCE(c.coach_id, c.trainer_id)
FROM public.clients c
ON CONFLICT (client_id) DO NOTHING;

-- 3) Triggers (SECURITY DEFINER; trigger body does not toggle row_security to avoid no-op)

-- A) After INSERT on public.checkins: update last_checkin_at, last_checkin_week_start, coach_id
CREATE OR REPLACE FUNCTION public.client_state_on_checkin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.client_state (client_id, coach_id, last_checkin_at, last_checkin_week_start, updated_at)
  SELECT NEW.client_id, COALESCE(c.coach_id, c.trainer_id), NEW.submitted_at, NEW.week_start, now()
  FROM public.clients c
  WHERE c.id = NEW.client_id
  ON CONFLICT (client_id) DO UPDATE SET
    last_checkin_at = EXCLUDED.last_checkin_at,
    last_checkin_week_start = EXCLUDED.last_checkin_week_start,
    coach_id = EXCLUDED.coach_id,
    updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_client_state_checkin
  AFTER INSERT ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.client_state_on_checkin();

-- B) After INSERT/UPDATE on public.client_compliance: update current_compliance
CREATE OR REPLACE FUNCTION public.client_state_on_compliance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_compliance NUMERIC;
BEGIN
  v_compliance := (COALESCE(NEW.training_adherence_pct, 0) + COALESCE(NEW.nutrition_adherence_pct, 0))
    / NULLIF((CASE WHEN NEW.training_adherence_pct IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN NEW.nutrition_adherence_pct IS NOT NULL THEN 1 ELSE 0 END), 0);

  INSERT INTO public.client_state (client_id, coach_id, current_compliance, updated_at)
  SELECT NEW.client_id, COALESCE(c.coach_id, c.trainer_id), v_compliance, now()
  FROM public.clients c
  WHERE c.id = NEW.client_id
  ON CONFLICT (client_id) DO UPDATE SET
    current_compliance = EXCLUDED.current_compliance,
    updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_client_state_compliance
  AFTER INSERT OR UPDATE ON public.client_compliance
  FOR EACH ROW EXECUTE FUNCTION public.client_state_on_compliance();

-- C) After INSERT/UPDATE/DELETE on public.client_flags: recalculate active_flags_count (unresolved = resolved_at IS NULL)
CREATE OR REPLACE FUNCTION public.client_state_on_flags()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
BEGIN
  v_client_id := COALESCE(NEW.client_id, OLD.client_id);

  INSERT INTO public.client_state (client_id, coach_id, active_flags_count, updated_at)
  SELECT v_client_id, COALESCE(c.coach_id, c.trainer_id),
         (SELECT count(*)::INT FROM public.client_flags f WHERE f.client_id = v_client_id AND f.resolved_at IS NULL),
         now()
  FROM public.clients c
  WHERE c.id = v_client_id
  ON CONFLICT (client_id) DO UPDATE SET
    active_flags_count = (SELECT count(*)::INT FROM public.client_flags f WHERE f.client_id = v_client_id AND f.resolved_at IS NULL),
    updated_at = now();
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_client_state_flags
  AFTER INSERT OR UPDATE OR DELETE ON public.client_flags
  FOR EACH ROW EXECUTE FUNCTION public.client_state_on_flags();

-- D) After INSERT on public.message_messages: update last_message_at (thread -> client_id via message_threads)
CREATE OR REPLACE FUNCTION public.client_state_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
BEGIN
  SELECT mt.client_id INTO v_client_id
  FROM public.message_threads mt
  WHERE mt.id = NEW.thread_id;
  IF v_client_id IS NOT NULL THEN
    INSERT INTO public.client_state (client_id, coach_id, last_message_at, updated_at)
    SELECT v_client_id, COALESCE(c.coach_id, c.trainer_id), now(), now()
    FROM public.clients c
    WHERE c.id = v_client_id
    ON CONFLICT (client_id) DO UPDATE SET
      last_message_at = now(),
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_client_state_message
  AFTER INSERT ON public.message_messages
  FOR EACH ROW EXECUTE FUNCTION public.client_state_on_message();

-- 4) RLS
ALTER TABLE public.client_state ENABLE ROW LEVEL SECURITY;

-- Coach: select rows where coach_id = auth.uid()
DROP POLICY IF EXISTS client_state_select_coach ON public.client_state;
CREATE POLICY client_state_select_coach ON public.client_state
  FOR SELECT USING (coach_id = auth.uid());

-- Client: select own row (client_id where clients.user_id = auth.uid())
DROP POLICY IF EXISTS client_state_select_client ON public.client_state;
CREATE POLICY client_state_select_client ON public.client_state
  FOR SELECT USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

COMMENT ON TABLE public.client_state IS 'One row per client; triggers keep last_checkin_at, last_checkin_week_start, current_compliance, active_flags_count, last_message_at updated.';
