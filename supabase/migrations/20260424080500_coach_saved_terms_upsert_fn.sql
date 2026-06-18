-- Atomic upsert with use_count increment on conflict (Postgres-native; avoids invalid client-side "increment" updates).

CREATE OR REPLACE FUNCTION public.upsert_coach_saved_term(p_coach_id uuid, p_category text, p_term text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_coach_id IS NULL OR p_coach_id <> auth.uid() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  IF p_category IS NULL OR btrim(p_category) = '' THEN
    RAISE EXCEPTION 'invalid category';
  END IF;
  IF p_term IS NULL OR btrim(p_term) = '' THEN
    RAISE EXCEPTION 'invalid term';
  END IF;

  INSERT INTO public.coach_saved_terms (coach_id, category, term, use_count, last_used_at)
  VALUES (p_coach_id, btrim(p_category), btrim(p_term), 1, now())
  ON CONFLICT (coach_id, category, term)
  DO UPDATE SET
    use_count = public.coach_saved_terms.use_count + 1,
    last_used_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_coach_saved_term(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_coach_saved_term(uuid, text, text) TO authenticated;

COMMENT ON FUNCTION public.upsert_coach_saved_term(uuid, text, text) IS 'Insert or bump use_count/last_used_at for a coach saved term; caller must be the coach (auth.uid()).';
