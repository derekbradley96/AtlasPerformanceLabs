CREATE TABLE IF NOT EXISTS public.account_deletion_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  role TEXT,
  reason TEXT NOT NULL,
  reason_detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.account_deletion_feedback DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.account_deletion_feedback IS 'Exit survey reasons captured before account deletion (service-role writes).';
