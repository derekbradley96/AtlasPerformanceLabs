-- Public-safe lookup: coach UUID -> referral_code for /join?coach= deep links (code may lag behind trigger/edge generation).

CREATE OR REPLACE FUNCTION public.get_coach_referral_code_for_join(p_coach_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(TRIM(p.referral_code), '')
  FROM public.profiles p
  WHERE p.id = p_coach_id
    AND p.role IS NOT NULL
    AND p.role IN ('coach', 'trainer')
    AND p.referral_code IS NOT NULL
    AND TRIM(p.referral_code) <> ''
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_coach_referral_code_for_join(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_coach_referral_code_for_join(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.get_coach_referral_code_for_join(uuid) IS 'Returns coach referral_code for join deep links; anon may call to resolve /join?coach=uuid.';
