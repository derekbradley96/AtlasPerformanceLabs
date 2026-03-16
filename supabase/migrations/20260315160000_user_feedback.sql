-- User feedback from coaches and Personal users. Authenticated users insert; admins read.

CREATE TABLE IF NOT EXISTS public.user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  role text,
  feedback_type text NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_feedback
  DROP CONSTRAINT IF EXISTS user_feedback_feedback_type_check;

ALTER TABLE public.user_feedback
  ADD CONSTRAINT user_feedback_feedback_type_check
  CHECK (feedback_type IN ('feature_request', 'bug', 'general_feedback', 'ui_feedback'));

CREATE INDEX IF NOT EXISTS user_feedback_profile_id_idx ON public.user_feedback(profile_id);
CREATE INDEX IF NOT EXISTS user_feedback_feedback_type_idx ON public.user_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS user_feedback_created_at_idx ON public.user_feedback(created_at DESC);

COMMENT ON TABLE public.user_feedback IS 'Beta feedback: feature requests, bugs, general and UI feedback from coaches and Personal users.';

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback (profile_id = auth.uid()).
DROP POLICY IF EXISTS user_feedback_insert_own ON public.user_feedback;
CREATE POLICY user_feedback_insert_own ON public.user_feedback
  FOR INSERT
  WITH CHECK (profile_id = auth.uid());

-- Users can read their own feedback.
DROP POLICY IF EXISTS user_feedback_select_own ON public.user_feedback;
CREATE POLICY user_feedback_select_own ON public.user_feedback
  FOR SELECT
  USING (profile_id = auth.uid());

-- Admins can read all.
DROP POLICY IF EXISTS user_feedback_select_admin ON public.user_feedback;
CREATE POLICY user_feedback_select_admin ON public.user_feedback
  FOR SELECT
  USING (
    (SELECT COALESCE(p.is_admin, false) FROM public.profiles p WHERE p.id = auth.uid())
  );
