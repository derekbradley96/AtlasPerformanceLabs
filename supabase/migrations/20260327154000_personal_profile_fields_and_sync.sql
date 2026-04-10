-- Personal profile data: store key fields directly on public.personal and keep synced from profiles/auth.
-- Uses only "Coaches" table for coach membership sync.

ALTER TABLE public.personal
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS primary_goal TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

COMMENT ON COLUMN public.personal.display_name IS 'Copied from profiles.display_name for personal users.';
COMMENT ON COLUMN public.personal.email IS 'Copied from profiles.email for personal users.';
COMMENT ON COLUMN public.personal.primary_goal IS 'Optional onboarding goal for personal users.';

CREATE OR REPLACE FUNCTION public.sync_profile_role_to_tables()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r TEXT;
  meta_goal TEXT;
BEGIN
  r := LOWER(TRIM(COALESCE(NEW.role, '')));

  -- Coach membership table
  IF r = 'coach' THEN
    INSERT INTO public."Coaches" (coach_id)
    VALUES (NEW.id::text)
    ON CONFLICT (coach_id) DO NOTHING;
    DELETE FROM public.personal WHERE user_id = NEW.id;
    RETURN NEW;
  END IF;

  -- Personal profile table
  IF r = 'personal' THEN
    SELECT NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'personal_goal', '')), '')
      INTO meta_goal
    FROM auth.users u
    WHERE u.id = NEW.id;

    INSERT INTO public.personal (user_id, display_name, email, primary_goal, updated_at)
    VALUES (
      NEW.id,
      NULLIF(TRIM(COALESCE(NEW.display_name, '')), ''),
      NULLIF(TRIM(COALESCE(NEW.email, '')), ''),
      meta_goal,
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      display_name = COALESCE(EXCLUDED.display_name, public.personal.display_name),
      email = COALESCE(EXCLUDED.email, public.personal.email),
      primary_goal = COALESCE(EXCLUDED.primary_goal, public.personal.primary_goal),
      updated_at = now();
    RETURN NEW;
  END IF;

  -- Client users should not remain in personal table.
  IF r = 'client' THEN
    DELETE FROM public.personal WHERE user_id = NEW.id;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_role_to_tables_trigger ON public.profiles;
CREATE TRIGGER sync_profile_role_to_tables_trigger
  AFTER INSERT OR UPDATE OF role, display_name, email ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_role_to_tables();

-- Backfill profile fields and optional goal for existing personal rows
UPDATE public.personal pe
SET
  display_name = COALESCE(pe.display_name, NULLIF(TRIM(COALESCE(p.display_name, '')), '')),
  email = COALESCE(pe.email, NULLIF(TRIM(COALESCE(p.email, '')), '')),
  primary_goal = COALESCE(
    pe.primary_goal,
    NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'personal_goal', '')), '')
  ),
  updated_at = now()
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE pe.user_id = p.id;
