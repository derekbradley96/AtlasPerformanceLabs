-- Peak week due count per coach: clients with active contest_preps and show_date within next 7 days.
-- Aligns with v_client_prep_header is_peak_week: (show_date - current_date) >= 0 AND <= 7.

DROP VIEW IF EXISTS public.v_coach_peak_week_due;

CREATE VIEW public.v_coach_peak_week_due
WITH (security_invoker = on)
AS
SELECT
  COALESCE(c.coach_id, c.trainer_id) AS coach_id,
  count(*)::integer AS count
FROM public.contest_preps p
JOIN public.clients c ON c.id = p.client_id
WHERE p.is_active = true
  AND p.show_date >= current_date
  AND p.show_date <= current_date + interval '7 days'
GROUP BY COALESCE(c.coach_id, c.trainer_id);

COMMENT ON VIEW public.v_coach_peak_week_due IS 'Peak week due count per coach. Query: SELECT count FROM v_coach_peak_week_due WHERE coach_id = auth.uid().';
