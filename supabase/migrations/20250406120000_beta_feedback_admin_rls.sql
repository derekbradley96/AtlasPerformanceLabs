-- Allow internal/admin users to read and update beta_feedback (inbox).
-- Add user IDs to public.beta_feedback_admins to grant access. Insert via Supabase dashboard or SQL.

CREATE TABLE IF NOT EXISTS public.beta_feedback_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.beta_feedback_admins IS 'User IDs allowed to view and update beta_feedback (inbox). Add admin users here.';

ALTER TABLE public.beta_feedback_admins ENABLE ROW LEVEL SECURITY;

-- Only admins can see who is an admin (optional; anon cannot read this table by default if we don't add a policy).
DROP POLICY IF EXISTS beta_feedback_admins_select_self ON public.beta_feedback_admins;
CREATE POLICY beta_feedback_admins_select_self ON public.beta_feedback_admins
  FOR SELECT USING (auth.uid() = user_id);

-- Allow SELECT on beta_feedback for users in beta_feedback_admins
DROP POLICY IF EXISTS beta_feedback_select_admin ON public.beta_feedback;
CREATE POLICY beta_feedback_select_admin ON public.beta_feedback
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM public.beta_feedback_admins)
  );

-- Allow UPDATE on beta_feedback for users in beta_feedback_admins (e.g. status changes)
DROP POLICY IF EXISTS beta_feedback_update_admin ON public.beta_feedback;
CREATE POLICY beta_feedback_update_admin ON public.beta_feedback
  FOR UPDATE USING (
    auth.uid() IN (SELECT user_id FROM public.beta_feedback_admins)
  );
