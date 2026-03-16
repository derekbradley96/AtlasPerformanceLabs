-- Canonical roles: coach, client, personal only. Backfill legacy trainer/solo/athlete to canonical.
-- No athlete or trainer as stored role; coaches have coach_focus: competition | transformation | integrated.

-- Backfill: trainer -> coach, solo/athlete -> personal (so app and RPCs see canonical values)
UPDATE public.profiles
SET role = 'coach'
WHERE LOWER(TRIM(COALESCE(role, ''))) = 'trainer';

UPDATE public.profiles
SET role = 'personal'
WHERE LOWER(TRIM(COALESCE(role, ''))) IN ('solo', 'athlete');

-- Optional: add check constraint so new/updated rows only allow canonical roles (uncomment if desired)
-- ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
-- ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
--   CHECK (role IS NULL OR LOWER(TRIM(role)) IN ('coach', 'client', 'personal'));

COMMENT ON COLUMN public.profiles.role IS 'Canonical role: coach | client | personal. Coach types (coach_focus): competition, transformation, integrated.';