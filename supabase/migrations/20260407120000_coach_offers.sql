-- Coach sellable offer (onboarding + future marketplace/checkout). One row per coach.

CREATE TABLE IF NOT EXISTS public.coach_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Online coaching',
  price_monthly INTEGER NOT NULL DEFAULT 100,
  currency TEXT NOT NULL DEFAULT 'GBP',
  includes_training BOOLEAN NOT NULL DEFAULT true,
  includes_nutrition BOOLEAN NOT NULL DEFAULT true,
  includes_checkins BOOLEAN NOT NULL DEFAULT true,
  includes_messaging BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS coach_offers_coach_id_key ON public.coach_offers(coach_id);

CREATE INDEX IF NOT EXISTS coach_offers_coach_id_idx ON public.coach_offers(coach_id);

COMMENT ON TABLE public.coach_offers IS 'Coach default coaching package: name, monthly price (whole currency units), inclusions. One row per coach for onboarding v2.';

CREATE OR REPLACE FUNCTION public.set_coach_offers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS coach_offers_updated_at ON public.coach_offers;
CREATE TRIGGER coach_offers_updated_at
  BEFORE UPDATE ON public.coach_offers
  FOR EACH ROW EXECUTE FUNCTION public.set_coach_offers_updated_at();

ALTER TABLE public.coach_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_offers_select_own ON public.coach_offers;
CREATE POLICY coach_offers_select_own ON public.coach_offers
  FOR SELECT TO authenticated
  USING (coach_id = auth.uid());

DROP POLICY IF EXISTS coach_offers_insert_own ON public.coach_offers;
CREATE POLICY coach_offers_insert_own ON public.coach_offers
  FOR INSERT TO authenticated
  WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS coach_offers_update_own ON public.coach_offers;
CREATE POLICY coach_offers_update_own ON public.coach_offers
  FOR UPDATE TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS coach_offers_delete_own ON public.coach_offers;
CREATE POLICY coach_offers_delete_own ON public.coach_offers
  FOR DELETE TO authenticated
  USING (coach_id = auth.uid());
