-- Atlas Marketplace / Coach Discovery: coach profiles, media, and inquiries.
-- Enables personal users to discover listed coaches and send inquiries.

-- 1) Marketplace coach profiles (one per coach; coach_id = profiles.id)
CREATE TABLE IF NOT EXISTS public.marketplace_coach_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  headline TEXT,
  bio TEXT,
  specialties TEXT[] NOT NULL DEFAULT '{}',
  divisions TEXT[] NOT NULL DEFAULT '{}',
  coaching_focus TEXT[] NOT NULL DEFAULT '{}',
  monthly_price_from NUMERIC,
  is_listed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_coach_profiles_coach_id_key
  ON public.marketplace_coach_profiles(coach_id);

CREATE INDEX IF NOT EXISTS marketplace_coach_profiles_is_listed_idx
  ON public.marketplace_coach_profiles(is_listed) WHERE is_listed = true;

COMMENT ON TABLE public.marketplace_coach_profiles IS 'Public-facing coach profile for marketplace discovery. One row per coach; is_listed controls visibility.';

-- Trigger: set updated_at on update
CREATE OR REPLACE FUNCTION public.set_marketplace_coach_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS marketplace_coach_profiles_updated_at ON public.marketplace_coach_profiles;
CREATE TRIGGER marketplace_coach_profiles_updated_at
  BEFORE UPDATE ON public.marketplace_coach_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_marketplace_coach_profiles_updated_at();

-- 2) Coach media (images/videos for profile)
CREATE TABLE IF NOT EXISTS public.marketplace_coach_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace_profile_id UUID NOT NULL REFERENCES public.marketplace_coach_profiles(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  media_path TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS marketplace_coach_media_profile_id_idx
  ON public.marketplace_coach_media(marketplace_profile_id);

COMMENT ON TABLE public.marketplace_coach_media IS 'Images and videos for a marketplace coach profile. media_path is storage or URL path.';

-- 3) Inquiries from users to coaches
CREATE TABLE IF NOT EXISTS public.coach_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'closed')),
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coach_inquiries_coach_id_idx ON public.coach_inquiries(coach_id);
CREATE INDEX IF NOT EXISTS coach_inquiries_user_profile_id_idx ON public.coach_inquiries(user_profile_id);

COMMENT ON TABLE public.coach_inquiries IS 'Inquiries from personal users to coaches. Creator = user_profile_id; coach_id is the coach being contacted.';

-- 4) RLS
ALTER TABLE public.marketplace_coach_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_coach_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_inquiries ENABLE ROW LEVEL SECURITY;

-- marketplace_coach_profiles: listed profiles readable by any authenticated user; coach manages own
DROP POLICY IF EXISTS marketplace_coach_profiles_select_listed ON public.marketplace_coach_profiles;
CREATE POLICY marketplace_coach_profiles_select_listed ON public.marketplace_coach_profiles
  FOR SELECT TO authenticated
  USING (is_listed = true OR coach_id = auth.uid());

DROP POLICY IF EXISTS marketplace_coach_profiles_insert_own ON public.marketplace_coach_profiles;
CREATE POLICY marketplace_coach_profiles_insert_own ON public.marketplace_coach_profiles
  FOR INSERT TO authenticated WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS marketplace_coach_profiles_update_own ON public.marketplace_coach_profiles;
CREATE POLICY marketplace_coach_profiles_update_own ON public.marketplace_coach_profiles
  FOR UPDATE TO authenticated USING (coach_id = auth.uid());

DROP POLICY IF EXISTS marketplace_coach_profiles_delete_own ON public.marketplace_coach_profiles;
CREATE POLICY marketplace_coach_profiles_delete_own ON public.marketplace_coach_profiles
  FOR DELETE TO authenticated USING (coach_id = auth.uid());

-- marketplace_coach_media: readable when profile is listed (or profile owner); coach manages own profile's media
DROP POLICY IF EXISTS marketplace_coach_media_select ON public.marketplace_coach_media;
CREATE POLICY marketplace_coach_media_select ON public.marketplace_coach_media
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_coach_profiles p
      WHERE p.id = marketplace_coach_media.marketplace_profile_id
      AND (p.is_listed = true OR p.coach_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS marketplace_coach_media_insert ON public.marketplace_coach_media;
CREATE POLICY marketplace_coach_media_insert ON public.marketplace_coach_media
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.marketplace_coach_profiles p
      WHERE p.id = marketplace_coach_media.marketplace_profile_id AND p.coach_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS marketplace_coach_media_update ON public.marketplace_coach_media;
CREATE POLICY marketplace_coach_media_update ON public.marketplace_coach_media
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_coach_profiles p
      WHERE p.id = marketplace_coach_media.marketplace_profile_id AND p.coach_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS marketplace_coach_media_delete ON public.marketplace_coach_media;
CREATE POLICY marketplace_coach_media_delete ON public.marketplace_coach_media
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_coach_profiles p
      WHERE p.id = marketplace_coach_media.marketplace_profile_id AND p.coach_id = auth.uid()
    )
  );

-- coach_inquiries: creator can create and read own; coach can read inquiries sent to them
DROP POLICY IF EXISTS coach_inquiries_select_creator ON public.coach_inquiries;
CREATE POLICY coach_inquiries_select_creator ON public.coach_inquiries
  FOR SELECT TO authenticated USING (user_profile_id = auth.uid());

DROP POLICY IF EXISTS coach_inquiries_select_coach ON public.coach_inquiries;
CREATE POLICY coach_inquiries_select_coach ON public.coach_inquiries
  FOR SELECT TO authenticated USING (coach_id = auth.uid());

DROP POLICY IF EXISTS coach_inquiries_insert_creator ON public.coach_inquiries;
CREATE POLICY coach_inquiries_insert_creator ON public.coach_inquiries
  FOR INSERT TO authenticated WITH CHECK (user_profile_id = auth.uid());

-- Coaches may update status (e.g. contacted, converted, closed)
DROP POLICY IF EXISTS coach_inquiries_update_coach ON public.coach_inquiries;
CREATE POLICY coach_inquiries_update_coach ON public.coach_inquiries
  FOR UPDATE TO authenticated USING (coach_id = auth.uid());
