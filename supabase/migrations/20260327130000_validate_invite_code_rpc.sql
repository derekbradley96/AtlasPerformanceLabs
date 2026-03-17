-- RPC to validate coach invite code in SQL (case-insensitive).
-- Edge Function calls this so lookup is not dependent on PostgREST filters.

CREATE OR REPLACE FUNCTION public.validate_invite_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_id uuid;
  v_display_name text;
  v_role text;
BEGIN
  v_code := lower(trim(nullif(p_code, '')));
  IF v_code = '' OR v_code IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid code');
  END IF;

  SELECT id, display_name, role
  INTO v_id, v_display_name, v_role
  FROM public.profiles
  WHERE referral_code = v_code
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  IF v_role IS NULL OR v_role NOT IN ('coach', 'trainer') THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Code is not for a coach');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'trainer_id', v_id,
    'coach_id', v_id,
    'trainer', jsonb_build_object(
      'id', v_id,
      'name', coalesce(v_display_name, 'Coach'),
      'niche', '',
      'monthlyRate', 10000
    )
  );
END;
$$;

COMMENT ON FUNCTION public.validate_invite_code(text) IS 'Validates coach invite code (referral_code). Case-insensitive. Returns { valid, trainer_id?, coach_id?, trainer?, error? }.';
