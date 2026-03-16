-- Ensure every client row visible to a coach has coach_id set so listing by coach_id or trainer_id is consistent.
-- Idempotent: only updates rows where coach_id IS NULL and trainer_id IS NOT NULL.

UPDATE public.clients
SET coach_id = trainer_id
WHERE coach_id IS NULL
  AND trainer_id IS NOT NULL;
