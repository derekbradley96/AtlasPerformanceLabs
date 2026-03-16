-- Keep coach_id and trainer_id in sync on public.clients so coaches are always attached.
-- 1) Backfill: set coach_id from trainer_id (or trainer_id from coach_id) where one is null.
-- 2) Trigger: on INSERT/UPDATE, ensure both columns are set when either is set.

-- 1) Backfill existing rows
UPDATE public.clients
SET coach_id = trainer_id
WHERE coach_id IS NULL AND trainer_id IS NOT NULL;

UPDATE public.clients
SET trainer_id = coach_id
WHERE trainer_id IS NULL AND coach_id IS NOT NULL;

-- 2) Trigger function: sync coach_id and trainer_id
CREATE OR REPLACE FUNCTION public.sync_clients_coach_trainer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When trainer_id is set and coach_id is null, set coach_id = trainer_id
  IF NEW.trainer_id IS NOT NULL AND NEW.coach_id IS NULL THEN
    NEW.coach_id := NEW.trainer_id;
  END IF;
  -- When coach_id is set and trainer_id is null, set trainer_id = coach_id
  IF NEW.coach_id IS NOT NULL AND NEW.trainer_id IS NULL THEN
    NEW.trainer_id := NEW.coach_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_clients_coach_trainer_trigger ON public.clients;
CREATE TRIGGER sync_clients_coach_trainer_trigger
  BEFORE INSERT OR UPDATE OF coach_id, trainer_id
  ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_clients_coach_trainer();

COMMENT ON FUNCTION public.sync_clients_coach_trainer() IS 'Keeps coach_id and trainer_id in sync on clients so both are set when either is set.';

-- 3) Backfill client_state.coach_id from clients where missing (so coach-scoped views see the client)
UPDATE public.client_state cs
SET coach_id = c.coach_id
FROM public.clients c
WHERE cs.client_id = c.id
  AND cs.coach_id IS NULL
  AND c.coach_id IS NOT NULL;

UPDATE public.client_state cs
SET coach_id = c.trainer_id
FROM public.clients c
WHERE cs.client_id = c.id
  AND cs.coach_id IS NULL
  AND c.trainer_id IS NOT NULL;
