-- Feature flags for safe rollouts. Read by app; only admins can update.

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key text NOT NULL UNIQUE,
  description text,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feature_flags_flag_key_idx ON public.feature_flags(flag_key);
CREATE INDEX IF NOT EXISTS feature_flags_enabled_idx ON public.feature_flags(enabled) WHERE enabled = true;

COMMENT ON TABLE public.feature_flags IS 'Feature flags for Atlas; app reads to show/hide features. Admin-only write.';

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Public read so app can check flags for all users (including anon).
DROP POLICY IF EXISTS feature_flags_select_authenticated ON public.feature_flags;
CREATE POLICY feature_flags_select_public ON public.feature_flags
  FOR SELECT
  USING (true);

-- Only platform admins can insert/update/delete.
DROP POLICY IF EXISTS feature_flags_insert_admin ON public.feature_flags;
CREATE POLICY feature_flags_insert_admin ON public.feature_flags
  FOR INSERT
  WITH CHECK (
    (SELECT COALESCE(p.is_admin, false) FROM public.profiles p WHERE p.id = auth.uid())
  );

DROP POLICY IF EXISTS feature_flags_update_admin ON public.feature_flags;
CREATE POLICY feature_flags_update_admin ON public.feature_flags
  FOR UPDATE
  USING (
    (SELECT COALESCE(p.is_admin, false) FROM public.profiles p WHERE p.id = auth.uid())
  );

DROP POLICY IF EXISTS feature_flags_delete_admin ON public.feature_flags;
CREATE POLICY feature_flags_delete_admin ON public.feature_flags
  FOR DELETE
  USING (
    (SELECT COALESCE(p.is_admin, false) FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Seed example flags (idempotent: insert only when missing).
INSERT INTO public.feature_flags (flag_key, description, enabled)
VALUES
  ('peak_week_engine', 'Peak week protocol and check-ins', false),
  ('team_coaching', 'Organisation and team coaching', false),
  ('marketplace', 'Coach marketplace and discovery', false),
  ('payments', 'Client subscriptions and payments', false),
  ('public_profiles', 'Public coach profiles and enquiries', false)
ON CONFLICT (flag_key) DO NOTHING;
