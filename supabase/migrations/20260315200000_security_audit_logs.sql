-- Security audit log: track security-relevant events. Written by app/backend; admins can read.

CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_audit_logs_profile_id_idx ON public.security_audit_logs(profile_id);
CREATE INDEX IF NOT EXISTS security_audit_logs_event_type_idx ON public.security_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS security_audit_logs_created_at_idx ON public.security_audit_logs(created_at DESC);

COMMENT ON TABLE public.security_audit_logs IS 'Security-relevant events: login, password_change, role_change, payment_update, organisation_change. Written by app; admins read.';
COMMENT ON COLUMN public.security_audit_logs.event_type IS 'e.g. login, password_change, role_change, payment_update, organisation_change';
COMMENT ON COLUMN public.security_audit_logs.metadata IS 'Optional JSON payload (e.g. ip, user_agent, target_id).';

ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- No INSERT policy for authenticated users: only service role or SECURITY DEFINER functions should write.
-- Admins can read for audit review.
DROP POLICY IF EXISTS security_audit_logs_select_admin ON public.security_audit_logs;
CREATE POLICY security_audit_logs_select_admin ON public.security_audit_logs
  FOR SELECT
  USING (
    (SELECT COALESCE(p.is_admin, false) FROM public.profiles p WHERE p.id = auth.uid())
  );
