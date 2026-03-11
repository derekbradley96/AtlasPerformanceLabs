-- Standardise ownership keys: profiles.user_id = auth.uid(), clients.coach_id = coach identity.
-- Does not drop trainer_id; use coach_id in new policies and views going forward.

-- 1) Ensure profiles is 1:1 with auth.users (profiles.id = auth.uid() in typical Supabase setup)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_id UUID;

UPDATE public.profiles
SET user_id = id
WHERE user_id IS NULL
  AND id IS NOT NULL;

-- Only set NOT NULL when every row has user_id (avoid breaking partial backfills)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id IS NULL LIMIT 1) THEN
    ALTER TABLE public.profiles ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_unique ON public.profiles(user_id);

COMMENT ON COLUMN public.profiles.user_id IS 'Same as id; 1:1 with auth.users(id). Use for clarity in policies.';

-- 2) Add coach_id to clients as the single source of ownership (keep trainer_id for now)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS coach_id UUID;

-- Backfill coach_id from trainer_id (in this repo trainer_id is used as coach identity in RLS = auth.uid())
UPDATE public.clients
SET coach_id = trainer_id
WHERE coach_id IS NULL
  AND trainer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS clients_coach_id_idx ON public.clients(coach_id);

COMMENT ON COLUMN public.clients.coach_id IS 'Coach identity (auth.uid()). Backfilled from trainer_id. Use in new policies; trainer_id kept for compatibility.';
