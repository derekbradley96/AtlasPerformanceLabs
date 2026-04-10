-- Four-table model: profiles (everyone), "Coaches" (coaches), clients (clients), personal (personal-only).
-- This migration: (1) creates public.personal, (2) syncs profile role -> "Coaches" / personal via trigger,
-- (3) backfills existing coaches into "Coaches" and personal users into personal.

-- =============================================================================
-- 1) Create public.personal (one row per personal-only user)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.personal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personal_user_id ON public.personal(user_id);

COMMENT ON TABLE public.personal IS 'One row per user with profile.role = personal (solo users, not coaches or clients).';

-- =============================================================================
-- 2) Trigger: on profile insert/update, sync to "Coaches" (coach) and personal (personal)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_profile_role_to_tables()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r TEXT;
BEGIN
  r := LOWER(TRIM(COALESCE(NEW.role, '')));

  -- Coach: ensure "Coaches" row exists (coach_id is TEXT; profile id is UUID).
  IF r = 'coach' THEN
    INSERT INTO public."Coaches" (coach_id)
    VALUES (NEW.id::text)
    ON CONFLICT (coach_id) DO NOTHING;
    -- Remove from personal if they were personal before (role change).
    DELETE FROM public.personal WHERE user_id = NEW.id;
    RETURN NEW;
  END IF;

  -- Personal: ensure personal row exists.
  IF r = 'personal' THEN
    INSERT INTO public.personal (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
  END IF;

  -- Client: remove from personal if they used to be personal (e.g. client-code signup flow).
  IF r = 'client' THEN
    DELETE FROM public.personal WHERE user_id = NEW.id;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_profile_role_to_tables() IS 'Sync profile.role to "Coaches" (coach) and personal (personal); remove from personal when client/coach.';

DROP TRIGGER IF EXISTS sync_profile_role_to_tables_trigger ON public.profiles;
CREATE TRIGGER sync_profile_role_to_tables_trigger
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_role_to_tables();

-- =============================================================================
-- 3) Backfill: existing coaches -> "Coaches", existing personal -> personal
-- =============================================================================

INSERT INTO public."Coaches" (coach_id)
SELECT id::text FROM public.profiles
WHERE LOWER(TRIM(COALESCE(role, ''))) = 'coach'
ON CONFLICT (coach_id) DO NOTHING;

INSERT INTO public.personal (user_id)
SELECT id FROM public.profiles
WHERE LOWER(TRIM(COALESCE(role, ''))) = 'personal'
ON CONFLICT (user_id) DO NOTHING;
