-- Waitlist capture for marketing landing: email, role interest, created_at.
-- RLS: anyone can INSERT (anon); only admins can SELECT.

CREATE TABLE IF NOT EXISTS public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role_interest TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON public.waitlist (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON public.waitlist (email);

COMMENT ON TABLE public.waitlist IS 'Marketing waitlist: email and role_interest from landing form.';

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Allow anonymous (and authenticated) insert for the landing form.
DROP POLICY IF EXISTS waitlist_insert_any ON public.waitlist;
CREATE POLICY waitlist_insert_any ON public.waitlist
  FOR INSERT WITH CHECK (true);

-- Allow SELECT only for admin users (profiles.is_admin).
DROP POLICY IF EXISTS waitlist_select_admin ON public.waitlist;
CREATE POLICY waitlist_select_admin ON public.waitlist
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );
