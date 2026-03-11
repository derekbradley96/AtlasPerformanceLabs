-- Add stable ownership column public.clients.coach_id (nullable).
-- Backfill from trainer_id or from public.trainers.user_id; do not remove trainer_id; do not touch atlas_*.

-- 1) Add column: public.clients.coach_id uuid (nullable)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS coach_id UUID;

-- 2) Backfill coach_id
-- Rule A: In this repo RLS uses trainer_id = auth.uid() (see clients_rls, checkins, etc.),
-- so trainer_id is treated as coach identity. Backfill coach_id = trainer_id first.
UPDATE public.clients
SET coach_id = trainer_id
WHERE coach_id IS NULL
  AND trainer_id IS NOT NULL;

-- Rule B: If public.trainers exists with user_id (text or uuid) that maps to auth.uid(),
-- backfill any remaining rows: coach_id = trainers.user_id where trainer_id = trainers.id.
-- (Only for rows still null; trainers.user_id may be TEXT so cast to uuid where valid.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trainers' AND column_name = 'user_id'
  ) THEN
    UPDATE public.clients c
    SET coach_id = (
      SELECT CASE
        WHEN t.user_id::text ~ '^[0-9a-fA-F-]{36}$' THEN (t.user_id::text)::uuid
        ELSE NULL
      END
      FROM public.trainers t
      WHERE t.id = c.trainer_id
      LIMIT 1
    )
    WHERE c.coach_id IS NULL
      AND c.trainer_id IS NOT NULL;
  END IF;
END $$;

-- 3) Index
CREATE INDEX IF NOT EXISTS clients_coach_id_idx ON public.clients(coach_id);

-- 4) trainer_id is not removed; no table renames.
-- 5) atlas_* tables are not touched.

COMMENT ON COLUMN public.clients.coach_id IS 'Stable coach identity (auth.uid()). Backfilled from trainer_id or trainers.user_id. trainer_id kept for compatibility.';
