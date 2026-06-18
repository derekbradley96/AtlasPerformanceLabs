CREATE OR REPLACE FUNCTION public.increment_coach_term_usage(
  p_coach_id UUID,
  p_category TEXT,
  p_term TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.coach_saved_terms
    SET use_count = use_count + 1,
        last_used_at = now()
  WHERE coach_id = p_coach_id
    AND category = p_category
    AND term = p_term;
END;
$$;
