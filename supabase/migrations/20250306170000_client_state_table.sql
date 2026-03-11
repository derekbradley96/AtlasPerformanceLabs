-- client_state: one row per client, maintained by triggers.
-- Columns per spec; triggers update last_checkin_at, current_compliance, active_flags.

-- Drop existing table and triggers so we can recreate with exact schema (triggers recreated below)
DROP TRIGGER IF EXISTS trg_client_state_checkin ON public.checkins;
DROP TRIGGER IF EXISTS trg_client_state_compliance ON public.client_compliance;
DROP TRIGGER IF EXISTS trg_client_state_flags ON public.client_flags;
DROP TABLE IF EXISTS public.client_state CASCADE;

CREATE TABLE public.client_state (
  client_id UUID PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  coach_id UUID,
  last_checkin_at TIMESTAMPTZ,
  current_compliance NUMERIC,
  active_flags INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX client_state_coach_idx ON public.client_state(coach_id);

-- Backfill one row per client
INSERT INTO public.client_state (client_id, coach_id)
SELECT c.id, COALESCE(c.coach_id, c.trainer_id)
FROM public.clients c
ON CONFLICT (client_id) DO NOTHING;

-- Trigger: checkins inserted -> update last_checkin_at
CREATE OR REPLACE FUNCTION public.client_state_on_checkin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.client_state (client_id, coach_id, last_checkin_at, updated_at)
  SELECT NEW.client_id, COALESCE(c.coach_id, c.trainer_id), NEW.submitted_at, now()
  FROM public.clients c
  WHERE c.id = NEW.client_id
  ON CONFLICT (client_id) DO UPDATE SET
    last_checkin_at = EXCLUDED.last_checkin_at,
    coach_id = EXCLUDED.coach_id,
    updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_client_state_checkin
  AFTER INSERT ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.client_state_on_checkin();

-- Trigger: client_compliance inserted/updated -> update current_compliance
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

-- Trigger: client_flags change -> recalculate active_flags
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

  INSERT INTO public.client_state (client_id, coach_id, active_flags, updated_at)
  SELECT v_client_id, COALESCE(c.coach_id, c.trainer_id),
         (SELECT count(*)::INT FROM public.client_flags f WHERE f.client_id = v_client_id AND f.resolved_at IS NULL),
         now()
  FROM public.clients c
  WHERE c.id = v_client_id
  ON CONFLICT (client_id) DO UPDATE SET
    active_flags = (SELECT count(*)::INT FROM public.client_flags f WHERE f.client_id = v_client_id AND f.resolved_at IS NULL),
    updated_at = now();
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_client_state_flags
  AFTER INSERT OR UPDATE OR DELETE ON public.client_flags
  FOR EACH ROW EXECUTE FUNCTION public.client_state_on_flags();
