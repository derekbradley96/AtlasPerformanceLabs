-- Marketplace listing infrastructure: coach_marketplace_profiles for coach discovery.
-- One row per coach; slug for public URLs; accepts_* and is_public control discoverability.

CREATE TABLE IF NOT EXISTS public.coach_marketplace_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  slug TEXT,
  headline TEXT,
  bio TEXT,
  location TEXT,
  pricing_summary TEXT,
  accepts_transformation BOOLEAN NOT NULL DEFAULT false,
  accepts_competition BOOLEAN NOT NULL DEFAULT false,
  accepts_personal_transitions BOOLEAN NOT NULL DEFAULT true,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One marketplace profile per coach
CREATE UNIQUE INDEX IF NOT EXISTS coach_marketplace_profiles_coach_id_key
  ON public.coach_marketplace_profiles(coach_id);

-- Public slug must be unique (nullable; multiple NULLs allowed)
CREATE UNIQUE INDEX IF NOT EXISTS coach_marketplace_profiles_slug_key
  ON public.coach_marketplace_profiles(slug)
  WHERE slug IS NOT NULL;

-- Discovery: list public profiles
CREATE INDEX IF NOT EXISTS coach_marketplace_profiles_is_public_idx
  ON public.coach_marketplace_profiles(is_public)
  WHERE is_public = true;

CREATE INDEX IF NOT EXISTS coach_marketplace_profiles_coach_id_idx
  ON public.coach_marketplace_profiles(coach_id);

COMMENT ON TABLE public.coach_marketplace_profiles IS 'Marketplace listing for coaches: display info, slug, acceptance flags, and public visibility. One row per coach.';

-- Trigger: set updated_at on update
CREATE OR REPLACE FUNCTION public.set_coach_marketplace_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS coach_marketplace_profiles_updated_at ON public.coach_marketplace_profiles;
CREATE TRIGGER coach_marketplace_profiles_updated_at
  BEFORE UPDATE ON public.coach_marketplace_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_coach_marketplace_profiles_updated_at();

-- RLS: coach manages own row; public profiles readable by all (authenticated for now; anon can be added for public pages)
ALTER TABLE public.coach_marketplace_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_marketplace_profiles_select_public_or_own ON public.coach_marketplace_profiles;
CREATE POLICY coach_marketplace_profiles_select_public_or_own ON public.coach_marketplace_profiles
  FOR SELECT TO authenticated
  USING (is_public = true OR coach_id = auth.uid());

DROP POLICY IF EXISTS coach_marketplace_profiles_insert_own ON public.coach_marketplace_profiles;
CREATE POLICY coach_marketplace_profiles_insert_own ON public.coach_marketplace_profiles
  FOR INSERT TO authenticated
  WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS coach_marketplace_profiles_update_own ON public.coach_marketplace_profiles;
CREATE POLICY coach_marketplace_profiles_update_own ON public.coach_marketplace_profiles
  FOR UPDATE TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS coach_marketplace_profiles_delete_own ON public.coach_marketplace_profiles;
CREATE POLICY coach_marketplace_profiles_delete_own ON public.coach_marketplace_profiles
  FOR DELETE TO authenticated
  USING (coach_id = auth.uid());
