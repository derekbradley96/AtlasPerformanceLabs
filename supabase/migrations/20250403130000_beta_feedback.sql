-- In-app beta feedback for coach, client, and personal users.
-- RLS: users can insert their own rows only.

CREATE TABLE IF NOT EXISTS public.beta_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  role TEXT,
  category TEXT NOT NULL CHECK (category IN ('bug', 'feature_request', 'confusion', 'general')),
  screen_name TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved'))
);

CREATE INDEX IF NOT EXISTS idx_beta_feedback_profile_id ON public.beta_feedback (profile_id);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_created_at ON public.beta_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_status ON public.beta_feedback (status) WHERE status = 'new';

COMMENT ON TABLE public.beta_feedback IS 'In-app beta feedback: bug, feature_request, confusion, general. status: new | reviewed | resolved.';

ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS beta_feedback_insert_own ON public.beta_feedback;
CREATE POLICY beta_feedback_insert_own ON public.beta_feedback
  FOR INSERT WITH CHECK (profile_id = auth.uid());
