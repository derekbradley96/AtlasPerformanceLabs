-- Gym / studio / partner affiliate programme (Atlas revenue share on referred signups).

CREATE TABLE IF NOT EXISTS public.affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('gym', 'studio', 'influencer', 'coach')),
  email TEXT NOT NULL UNIQUE,
  affiliate_code TEXT NOT NULL UNIQUE,
  commission_pct NUMERIC NOT NULL DEFAULT 20,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended')),
  city TEXT,
  coach_count_band TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliates_affiliate_code_lower ON public.affiliates (lower(affiliate_code));
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON public.affiliates (status);

CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates (id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  referred_email TEXT,
  referral_type TEXT NOT NULL
    CHECK (referral_type IN ('coach_signup', 'client_signup')),
  commission_amount NUMERIC,
  commission_status TEXT DEFAULT 'pending'
    CHECK (commission_status IN ('pending', 'paid', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_referrals_affiliate_user_unique
  ON public.affiliate_referrals (affiliate_id, referred_user_id)
  WHERE referred_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_affiliate_id ON public.affiliate_referrals (affiliate_id);

-- Safe lookup for signup (avoids broad SELECT on affiliates for anon/authenticated).
CREATE OR REPLACE FUNCTION public.lookup_active_affiliate_id(p_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.affiliates
  WHERE lower(trim(affiliate_code)) = lower(trim(p_code))
    AND status = 'active'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_active_affiliate_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_active_affiliate_id(text) TO anon, authenticated;

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS affiliates_select_own ON public.affiliates;
CREATE POLICY affiliates_select_own
  ON public.affiliates
  FOR SELECT
  TO authenticated
  USING (
    lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
  );

DROP POLICY IF EXISTS affiliates_insert_application ON public.affiliates;
CREATE POLICY affiliates_insert_application
  ON public.affiliates
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'pending');

DROP POLICY IF EXISTS affiliate_referrals_insert_own_signup ON public.affiliate_referrals;
CREATE POLICY affiliate_referrals_insert_own_signup
  ON public.affiliate_referrals
  FOR INSERT
  TO authenticated
  WITH CHECK (referred_user_id = auth.uid());

DROP POLICY IF EXISTS affiliate_referrals_select_parties ON public.affiliate_referrals;
CREATE POLICY affiliate_referrals_select_parties
  ON public.affiliate_referrals
  FOR SELECT
  TO authenticated
  USING (
    referred_user_id = auth.uid()
    OR affiliate_id IN (
      SELECT a.id
      FROM public.affiliates a
      WHERE lower(a.email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    )
  );
