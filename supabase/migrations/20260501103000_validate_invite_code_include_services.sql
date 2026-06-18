-- Prospective clients cannot SELECT atlas_services (coach-only RLS). Include active packages in validate_invite_code (SECURITY DEFINER).

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
  v_services jsonb;
BEGIN
  v_code := lower(trim(nullif(p_code, '')));
  IF v_code = '' OR v_code IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid code');
  END IF;

  SELECT id, display_name, role
  INTO v_id, v_display_name, v_role
  FROM public.profiles
  WHERE lower(trim(referral_code)) = v_code
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  IF v_role IS NULL OR v_role NOT IN ('coach', 'trainer') THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Code is not for a coach');
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'description', s.description,
        'price_amount', s.price_amount,
        'currency', s.currency,
        'interval', s.interval,
        'stripe_price_id', s.stripe_price_id
      ) ORDER BY s.created_at
    ),
    '[]'::jsonb
  )
  INTO v_services
  FROM public.atlas_services s
  INNER JOIN public.atlas_coaches ac ON ac.id = s.coach_id
  WHERE ac.user_id = v_id::text
    AND s.active = true;

  RETURN jsonb_build_object(
    'valid', true,
    'trainer_id', v_id,
    'coach_id', v_id,
    'services', coalesce(v_services, '[]'::jsonb),
    'trainer', jsonb_build_object(
      'id', v_id,
      'name', coalesce(v_display_name, 'Coach'),
      'niche', '',
      'monthlyRate', 10000
    )
  );
END;
$$;

COMMENT ON FUNCTION public.validate_invite_code(text) IS 'Validates coach invite code; returns coach id, trainer summary, and active atlas_services[] for client onboarding.';
