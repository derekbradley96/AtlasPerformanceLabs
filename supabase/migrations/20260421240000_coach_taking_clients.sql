-- Public coach profile: whether the coach is actively taking new clients.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS taking_clients BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.taking_clients IS 'When true, public coach page shows “Currently taking clients”; false shows waitlist-only.';
