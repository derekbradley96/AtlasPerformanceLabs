-- Track Personal → Client transition on the same account (identity preserved).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS linked_from_personal_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.profiles.linked_from_personal_at IS
  'Set when profiles.role changes from personal to client via coach link; training/nutrition/progress history remain under the same user id.';
