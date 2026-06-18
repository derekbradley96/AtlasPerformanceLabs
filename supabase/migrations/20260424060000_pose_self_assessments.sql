-- Personal self pose assessments (solo comp prep).

CREATE TABLE IF NOT EXISTS public.pose_self_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pose_id TEXT NOT NULL,
  division TEXT NOT NULL,
  checklist_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  overall_score INTEGER,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pose_self_assessments_profile_id ON public.pose_self_assessments(profile_id);
CREATE INDEX IF NOT EXISTS idx_pose_self_assessments_assessed_at ON public.pose_self_assessments(assessed_at DESC);

ALTER TABLE public.pose_self_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pose_self_assessments_select_own ON public.pose_self_assessments;
CREATE POLICY pose_self_assessments_select_own ON public.pose_self_assessments
  FOR SELECT TO authenticated
  USING (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS pose_self_assessments_insert_own ON public.pose_self_assessments;
CREATE POLICY pose_self_assessments_insert_own ON public.pose_self_assessments
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS pose_self_assessments_update_own ON public.pose_self_assessments;
CREATE POLICY pose_self_assessments_update_own ON public.pose_self_assessments
  FOR UPDATE TO authenticated
  USING (profile_id = (SELECT auth.uid()))
  WITH CHECK (profile_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE ON TABLE public.pose_self_assessments TO authenticated;
