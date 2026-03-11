-- Pose scoring: per-pose-check-item scores from coach (symmetry, conditioning, presentation).
-- One row per pose_check_item per coach; coaches can update their own score row.

CREATE TABLE IF NOT EXISTS public.pose_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pose_check_item_id UUID NOT NULL REFERENCES public.pose_check_items(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  symmetry_score INTEGER,
  conditioning_score INTEGER,
  presentation_score INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pose_scores_item_coach
  ON public.pose_scores(pose_check_item_id, coach_id);

CREATE INDEX IF NOT EXISTS idx_pose_scores_pose_check_item_id ON public.pose_scores(pose_check_item_id);
CREATE INDEX IF NOT EXISTS idx_pose_scores_coach_id ON public.pose_scores(coach_id);
CREATE INDEX IF NOT EXISTS idx_pose_scores_created_at ON public.pose_scores(created_at DESC);

COMMENT ON TABLE public.pose_scores IS 'Coach scores per pose check item: symmetry, conditioning, presentation. One row per (pose_check_item_id, coach_id).';
COMMENT ON COLUMN public.pose_scores.symmetry_score IS 'Score for symmetry (scale defined by app, e.g. 1-10).';
COMMENT ON COLUMN public.pose_scores.conditioning_score IS 'Score for conditioning.';
COMMENT ON COLUMN public.pose_scores.presentation_score IS 'Score for presentation/posing.';

ALTER TABLE public.pose_scores ENABLE ROW LEVEL SECURITY;

-- Coach: full access to rows they created (coach_id = auth.uid())
DROP POLICY IF EXISTS pose_scores_select_coach ON public.pose_scores;
DROP POLICY IF EXISTS pose_scores_insert_coach ON public.pose_scores;
DROP POLICY IF EXISTS pose_scores_update_coach ON public.pose_scores;
DROP POLICY IF EXISTS pose_scores_delete_coach ON public.pose_scores;

CREATE POLICY pose_scores_select_coach ON public.pose_scores
  FOR SELECT USING (coach_id = auth.uid());

CREATE POLICY pose_scores_insert_coach ON public.pose_scores
  FOR INSERT WITH CHECK (coach_id = auth.uid());

CREATE POLICY pose_scores_update_coach ON public.pose_scores
  FOR UPDATE USING (coach_id = auth.uid());

CREATE POLICY pose_scores_delete_coach ON public.pose_scores
  FOR DELETE USING (coach_id = auth.uid());

-- Client: read-only access to scores for their own pose checks (via pose_check_items → pose_checks → clients.user_id)
DROP POLICY IF EXISTS pose_scores_select_client ON public.pose_scores;

CREATE POLICY pose_scores_select_client ON public.pose_scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.pose_check_items pci
      JOIN public.pose_checks pc ON pc.id = pci.pose_check_id
      JOIN public.clients c ON c.id = pc.client_id
      WHERE pci.id = pose_scores.pose_check_item_id AND c.user_id = auth.uid()
    )
  );
