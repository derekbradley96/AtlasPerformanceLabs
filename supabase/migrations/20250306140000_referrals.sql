-- Atlas referral system: coach_referrals for coach growth.
-- referrer_coach_id = coach who sent the invite; referred_coach_email/id = invited coach; status tracks funnel.

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

COMMENT ON TABLE public.coach_referrals IS 'Coach referral funnel: invited -> signed_up -> activated -> rewarded.';

ALTER TABLE public.coach_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_referrals_select_own ON public.coach_referrals;
DROP POLICY IF EXISTS coach_referrals_insert_own ON public.coach_referrals;
DROP POLICY IF EXISTS coach_referrals_update_own ON public.coach_referrals;

-- Referrer can see and create referrals they own; can update (e.g. status) only their own rows.
CREATE POLICY coach_referrals_select_own ON public.coach_referrals
  FOR SELECT USING (referrer_coach_id = auth.uid());
CREATE POLICY coach_referrals_insert_own ON public.coach_referrals
  FOR INSERT WITH CHECK (referrer_coach_id = auth.uid());
CREATE POLICY coach_referrals_update_own ON public.coach_referrals
  FOR UPDATE USING (referrer_coach_id = auth.uid());
