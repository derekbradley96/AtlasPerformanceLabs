CREATE OR REPLACE FUNCTION public.append_ice_candidate(
  p_id UUID,
  p_column TEXT,
  p_candidate JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_column NOT IN ('caller_ice', 'callee_ice') THEN
    RAISE EXCEPTION 'Invalid ICE column: %', p_column;
  END IF;

  IF p_column = 'caller_ice' THEN
    UPDATE public.checkin_call_requests
    SET
      caller_ice = COALESCE(caller_ice, '[]'::jsonb) || jsonb_build_array(p_candidate),
      updated_at = NOW()
    WHERE id = p_id;
  ELSE
    UPDATE public.checkin_call_requests
    SET
      callee_ice = COALESCE(callee_ice, '[]'::jsonb) || jsonb_build_array(p_candidate),
      updated_at = NOW()
    WHERE id = p_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.append_ice_candidate(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.append_ice_candidate(UUID, TEXT, JSONB) TO service_role;
