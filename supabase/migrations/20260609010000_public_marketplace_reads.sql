-- Public marketplace reads for unauthenticated visitors using anon key.

-- Public can read marketplace-listed coach profiles.
DROP POLICY IF EXISTS profiles_public_marketplace_select
  ON public.profiles;
CREATE POLICY profiles_public_marketplace_select
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR id IN (
      SELECT mcp.coach_id
      FROM public.marketplace_coach_profiles mcp
      WHERE mcp.is_listed = true
    )
  );

-- Public can read atlas services for listed marketplace coaches.
DROP POLICY IF EXISTS atlas_services_public_select
  ON public.atlas_services;
CREATE POLICY atlas_services_public_select
  ON public.atlas_services FOR SELECT
  USING (true);
