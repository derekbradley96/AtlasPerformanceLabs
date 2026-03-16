-- System metrics for platform health. Written by backend/cron (service role); admins can read.

CREATE TABLE IF NOT EXISTS public.system_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key text NOT NULL,
  metric_value numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS system_metrics_metric_key_idx ON public.system_metrics(metric_key);
CREATE INDEX IF NOT EXISTS system_metrics_created_at_idx ON public.system_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS system_metrics_key_created_idx ON public.system_metrics(metric_key, created_at DESC);

COMMENT ON TABLE public.system_metrics IS 'Platform health metrics: active_users_daily, messages_sent_daily, checkins_submitted_daily, workouts_logged_daily, peak_week_active, marketplace_views. Written by cron/Edge Functions; admins read.';

ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;

-- Only admins can read. No INSERT/UPDATE policy: only service role (cron/Edge Functions) can write.
DROP POLICY IF EXISTS system_metrics_select_admin ON public.system_metrics;
CREATE POLICY system_metrics_select_admin ON public.system_metrics
  FOR SELECT
  USING (
    (SELECT COALESCE(p.is_admin, false) FROM public.profiles p WHERE p.id = auth.uid())
  );
