-- Client state summary table: one row per client, updated by triggers for scale.
-- Use for coach dashboards and attention/retention views without scanning checkins/flags every time.

CREATE TABLE IF NOT EXISTS public.client_state (
  client_id UUID PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  coach_id UUID,
  last_checkin_at TIMESTAMPTZ,
  last_checkin_week_start DATE,
  current_compliance NUMERIC,
  active_flags_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_state_coach_id_idx ON public.client_state(coach_id);
CREATE INDEX IF NOT EXISTS client_state_coach_attention_idx ON public.client_state(coach_id, last_checkin_at DESC NULLS LAST);

COMMENT ON TABLE public.client_state IS 'Summary per client for dashboards; maintained by triggers on checkins, client_compliance, client_flags.';

-- Backfill initial rows (coach_id from coach_id or trainer_id for compatibility)
INSERT INTO public.client_state (client_id, coach_id)
SELECT c.id, COALESCE(c.coach_id, c.trainer_id)
FROM public.clients c
ON CONFLICT (client_id) DO NOTHING;

-- Trigger: when checkins inserted, update client_state
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

DROP TRIGGER IF EXISTS trg_client_state_checkin ON public.checkins;
CREATE TRIGGER trg_client_state_checkin
  AFTER INSERT ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.client_state_on_checkin();

-- Trigger: when client_compliance changes, update current_compliance (average of training + nutrition adherence)
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

DROP TRIGGER IF EXISTS trg_client_state_compliance ON public.client_compliance;
CREATE TRIGGER trg_client_state_compliance
  AFTER INSERT OR UPDATE ON public.client_compliance
  FOR EACH ROW EXECUTE FUNCTION public.client_state_on_compliance();

-- Trigger: when client_flags change, refresh active_flags_count (unresolved = resolved_at IS NULL)
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

DROP TRIGGER IF EXISTS trg_client_state_flags ON public.client_flags;
CREATE TRIGGER trg_client_state_flags
  AFTER INSERT OR UPDATE OR DELETE ON public.client_flags
  FOR EACH ROW EXECUTE FUNCTION public.client_state_on_flags();
