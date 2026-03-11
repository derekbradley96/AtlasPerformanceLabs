-- Reward coaches for successful referrals: when referred coach gets first paying client,
-- set referral status → activated and give referrer free_month_credit += 1.

-- 1) Add free_month_credit to profiles (referrer reward counter)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS free_month_credit INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.free_month_credit IS 'Free month credits earned from referrals (activated).';

-- 2) Function: when a client becomes billing_status = 'active', if coach has first paying client
--    and has a referral in signed_up, set referral to activated and reward referrer.
CREATE OR REPLACE FUNCTION public.on_client_billing_active_referral_reward()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coach_id UUID;
  v_active_count INT;
  v_referrer_id UUID;
BEGIN
  IF NEW.billing_status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.billing_status = 'active' THEN
    RETURN NEW;
  END IF;

  v_coach_id := COALESCE(NEW.coach_id, NEW.trainer_id);
  IF v_coach_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*)::int INTO v_active_count
  FROM public.clients c
  WHERE (c.coach_id = v_coach_id OR c.trainer_id = v_coach_id)
    AND c.billing_status = 'active';

  IF v_active_count <> 1 THEN
    RETURN NEW;
  END IF;

  SELECT referrer_coach_id INTO v_referrer_id
  FROM public.coach_referrals
  WHERE referred_coach_id = v_coach_id
    AND status = 'signed_up'
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.coach_referrals
  SET status = 'activated'
  WHERE referred_coach_id = v_coach_id
    AND status = 'signed_up';

  UPDATE public.profiles
  SET free_month_credit = COALESCE(free_month_credit, 0) + 1
  WHERE id = v_referrer_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS client_billing_active_referral_reward_trigger ON public.clients;
CREATE TRIGGER client_billing_active_referral_reward_trigger
  AFTER INSERT OR UPDATE OF billing_status
  ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.on_client_billing_active_referral_reward();

COMMENT ON FUNCTION public.on_client_billing_active_referral_reward() IS 'On client billing_status = active: if referred coach has first paying client, set referral to activated and increment referrer free_month_credit.';
