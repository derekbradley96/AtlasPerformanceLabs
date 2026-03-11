-- Beta support requests: urgent issue, request help, onboarding question.
-- RLS: users can insert their own rows only (profile_id = auth.uid()).

CREATE TABLE IF NOT EXISTS public.beta_support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  role TEXT,
  request_type TEXT NOT NULL CHECK (request_type IN ('urgent_issue', 'request_help', 'onboarding_question')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved'))
);

CREATE INDEX IF NOT EXISTS idx_beta_support_requests_profile_id ON public.beta_support_requests (profile_id);
CREATE INDEX IF NOT EXISTS idx_beta_support_requests_created_at ON public.beta_support_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beta_support_requests_status ON public.beta_support_requests (status) WHERE status = 'new';

COMMENT ON TABLE public.beta_support_requests IS 'Beta support: urgent_issue, request_help, onboarding_question. status: new | in_progress | resolved.';

ALTER TABLE public.beta_support_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS beta_support_requests_insert_own ON public.beta_support_requests;
CREATE POLICY beta_support_requests_insert_own ON public.beta_support_requests
  FOR INSERT WITH CHECK (profile_id = auth.uid());
