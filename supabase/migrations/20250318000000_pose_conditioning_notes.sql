-- Coach tags for visual changes in poses (conditioning, fullness, detail).
-- One row per tag per pose_check_item per coach. Optional note per tag.

CREATE TABLE IF NOT EXISTS public.pose_conditioning_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pose_check_item_id UUID NOT NULL REFERENCES public.pose_check_items(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL,
  tag TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pose_conditioning_notes_tag_check CHECK (tag IN (
    'conditioning_improved',
    'fullness_drop',
    'glutes_not_in',
    'hamstring_detail',
    'back_density'
  ))
);

CREATE INDEX IF NOT EXISTS idx_pose_conditioning_notes_item
  ON public.pose_conditioning_notes(pose_check_item_id);
CREATE INDEX IF NOT EXISTS idx_pose_conditioning_notes_coach
  ON public.pose_conditioning_notes(coach_id);

COMMENT ON TABLE public.pose_conditioning_notes IS 'Coach tags for visual changes in pose check images: conditioning_improved, fullness_drop, glutes_not_in, hamstring_detail, back_density.';

ALTER TABLE public.pose_conditioning_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pose_conditioning_notes_select_coach ON public.pose_conditioning_notes;
DROP POLICY IF EXISTS pose_conditioning_notes_insert_coach ON public.pose_conditioning_notes;
DROP POLICY IF EXISTS pose_conditioning_notes_update_coach ON public.pose_conditioning_notes;
DROP POLICY IF EXISTS pose_conditioning_notes_delete_coach ON public.pose_conditioning_notes;

CREATE POLICY pose_conditioning_notes_select_coach ON public.pose_conditioning_notes
  FOR SELECT USING (coach_id = auth.uid());

CREATE POLICY pose_conditioning_notes_insert_coach ON public.pose_conditioning_notes
  FOR INSERT WITH CHECK (coach_id = auth.uid());

CREATE POLICY pose_conditioning_notes_update_coach ON public.pose_conditioning_notes
  FOR UPDATE USING (coach_id = auth.uid());

CREATE POLICY pose_conditioning_notes_delete_coach ON public.pose_conditioning_notes
  FOR DELETE USING (coach_id = auth.uid());
