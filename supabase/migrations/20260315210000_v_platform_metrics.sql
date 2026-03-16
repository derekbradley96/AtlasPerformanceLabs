-- Platform-wide metrics view for admin analytics. Single row: totals across profiles, revenue, peak weeks, organisations.

CREATE OR REPLACE VIEW public.v_platform_metrics
WITH (security_invoker = true)
AS
SELECT
  (SELECT COUNT(*)::bigint FROM public.profiles) AS total_users,
  (SELECT COUNT(*)::bigint FROM public.profiles WHERE LOWER(COALESCE(role, '')) IN ('coach', 'trainer')) AS total_coaches,
  (SELECT COUNT(*)::bigint FROM public.profiles WHERE LOWER(COALESCE(role, '')) = 'client') AS total_clients,
  (SELECT COUNT(*)::bigint FROM public.profiles WHERE LOWER(COALESCE(role, '')) IN ('solo', 'personal')) AS total_personal_users,
  (SELECT COALESCE(SUM(amount), 0)::numeric FROM public.client_payments WHERE status = 'paid') AS total_revenue,
  (SELECT COUNT(*)::bigint FROM public.peak_weeks WHERE is_active = true) AS active_peak_weeks,
  (SELECT COUNT(*)::bigint FROM public.organisations) AS active_organisations;

COMMENT ON VIEW public.v_platform_metrics IS 'Platform-wide metrics: total users by role, total revenue (paid payments), active peak weeks, organisations. Single row.';
