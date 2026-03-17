-- One-off helper: set a coach's referral_code by email. Run in SQL Editor when needed.
-- Example: SELECT set_coach_invite_code('your-coach@example.com', 'atlas-3034');

CREATE OR REPLACE FUNCTION public.set_coach_invite_code(p_email text, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := lower(trim(nullif(p_code, '')));
  v_id uuid;
  v_updated int;
BEGIN
  IF v_code = '' OR v_code IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Code cannot be empty');
  END IF;

  SELECT id INTO v_id
  FROM public.profiles
  WHERE role IN ('coach', 'trainer')
    AND (email = trim(p_email) OR email ILIKE trim(p_email))
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No coach found with that email');
  END IF;

  UPDATE public.profiles
  SET referral_code = v_code
  WHERE id = v_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'profile_id', v_id, 'referral_code', v_code, 'updated', (v_updated > 0));
END;
$$;

COMMENT ON FUNCTION public.set_coach_invite_code(text, text) IS 'Set referral_code for a coach by email. Example: SELECT set_coach_invite_code(''coach@example.com'', ''atlas-3034'');';
