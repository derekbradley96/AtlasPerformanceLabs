-- Track referral usage at coach signup: RPC that creates coach_referrals with status = signed_up.
-- Called by the app after signUp when referral_code was used; runs as current user, inserts one row.

-- Ensure coach_referrals exists when 20250306140000_referrals.sql was never applied on this DB
-- (e.g. out-of-order push). Idempotent: no-op if table already present.
CREATE TABLE IF NOT EXISTS public.coach_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_coach_email TEXT NOT NULL,
  referred_coach_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'signed_up', 'activated', 'rewarded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_referrals_referrer ON public.coach_referrals(referrer_coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_referrals_status ON public.coach_referrals(status);
CREATE INDEX IF NOT EXISTS idx_coach_referrals_referred_id ON public.coach_referrals(referred_coach_id) WHERE referred_coach_id IS NOT NULL;

ALTER TABLE public.coach_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_referrals_select_own ON public.coach_referrals;
DROP POLICY IF EXISTS coach_referrals_insert_own ON public.coach_referrals;
DROP POLICY IF EXISTS coach_referrals_update_own ON public.coach_referrals;

CREATE POLICY coach_referrals_select_own ON public.coach_referrals
  FOR SELECT USING (referrer_coach_id = auth.uid());
CREATE POLICY coach_referrals_insert_own ON public.coach_referrals
  FOR INSERT WITH CHECK (referrer_coach_id = auth.uid());
CREATE POLICY coach_referrals_update_own ON public.coach_referrals
  FOR UPDATE USING (referrer_coach_id = auth.uid());

-- One referral record per (referrer, referred) when referred is set
CREATE UNIQUE INDEX IF NOT EXISTS coach_referrals_referrer_referred_unique
  ON public.coach_referrals(referrer_coach_id, referred_coach_id)
  WHERE referred_coach_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_referral_signup(p_referral_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
  v_referred_id UUID;
  v_email TEXT;
  v_code TEXT;
BEGIN
  v_referred_id := auth.uid();
  IF v_referred_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  v_code := lower(trim(p_referral_code));
  IF v_code = '' OR v_code IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_code');
  END IF;

  -- Referrer cannot refer themselves
  SELECT id INTO v_referrer_id
  FROM public.profiles
  WHERE referral_code = v_code AND id IS NOT NULL;
  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;
  IF v_referrer_id = v_referred_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self_referral');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_referred_id LIMIT 1;
  IF v_email IS NULL THEN
    v_email := '';
  END IF;

  INSERT INTO public.coach_referrals (
    referrer_coach_id,
    referred_coach_email,
    referred_coach_id,
    status
  ) VALUES (
    v_referrer_id,
    v_email,
    v_referred_id,
    'signed_up'
  );

  RETURN jsonb_build_object('ok', true);
EXCEPTION
  WHEN unique_violation THEN
    -- Already recorded (e.g. duplicate submit)
    RETURN jsonb_build_object('ok', true);
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.record_referral_signup(TEXT) IS 'Record that the current user (coach) signed up with a referral code. Creates coach_referrals row with status signed_up.';

-- Grant execute to authenticated users (referred coach calls this after signup)
GRANT EXECUTE ON FUNCTION public.record_referral_signup(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_referral_signup(TEXT) TO service_role;
