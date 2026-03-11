-- Structured pose check items per mandatory division. One row per pose per pose_check.
-- pose_checks.photos JSONB remains for backward compatibility; pose_check_items is the structured source of truth going forward.

CREATE TABLE IF NOT EXISTS public.pose_check_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pose_check_id UUID NOT NULL REFERENCES public.pose_checks(id) ON DELETE CASCADE,
  pose_key TEXT NOT NULL,
  pose_label TEXT NOT NULL,
  photo_path TEXT,
  coach_rating INTEGER,
  coach_notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS pose_check_items_pose_check_pose_key
  ON public.pose_check_items(pose_check_id, pose_key);

CREATE INDEX IF NOT EXISTS pose_check_items_pose_check_id_idx
  ON public.pose_check_items(pose_check_id);

COMMENT ON TABLE public.pose_check_items IS 'Per-pose rows for a pose check: photo_path, coach_rating, coach_notes. Populated from pose_division_templates when pose_check is created for a client with active prep and division_key.';

-- RLS: same as pose_checks — coach sees client's items, client sees own
ALTER TABLE public.pose_check_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pose_check_items_select_coach ON public.pose_check_items;
DROP POLICY IF EXISTS pose_check_items_select_client ON public.pose_check_items;
DROP POLICY IF EXISTS pose_check_items_insert_coach ON public.pose_check_items;
DROP POLICY IF EXISTS pose_check_items_insert_client ON public.pose_check_items;
DROP POLICY IF EXISTS pose_check_items_update_coach ON public.pose_check_items;
DROP POLICY IF EXISTS pose_check_items_update_client ON public.pose_check_items;
DROP POLICY IF EXISTS pose_check_items_delete_coach ON public.pose_check_items;
DROP POLICY IF EXISTS pose_check_items_delete_client ON public.pose_check_items;

CREATE POLICY pose_check_items_select_coach ON public.pose_check_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.pose_checks pc
    INNER JOIN public.clients c ON c.id = pc.client_id
    WHERE pc.id = pose_check_items.pose_check_id AND c.coach_id = auth.uid()
  )
);
CREATE POLICY pose_check_items_select_client ON public.pose_check_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.pose_checks pc
    INNER JOIN public.clients c ON c.id = pc.client_id
    WHERE pc.id = pose_check_items.pose_check_id AND c.user_id = auth.uid()
  )
);
CREATE POLICY pose_check_items_insert_coach ON public.pose_check_items FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pose_checks pc
    INNER JOIN public.clients c ON c.id = pc.client_id
    WHERE pc.id = pose_check_items.pose_check_id AND c.coach_id = auth.uid()
  )
);
CREATE POLICY pose_check_items_insert_client ON public.pose_check_items FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pose_checks pc
    INNER JOIN public.clients c ON c.id = pc.client_id
    WHERE pc.id = pose_check_items.pose_check_id AND c.user_id = auth.uid()
  )
);
CREATE POLICY pose_check_items_update_coach ON public.pose_check_items FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.pose_checks pc
    INNER JOIN public.clients c ON c.id = pc.client_id
    WHERE pc.id = pose_check_items.pose_check_id AND c.coach_id = auth.uid()
  )
);
CREATE POLICY pose_check_items_update_client ON public.pose_check_items FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.pose_checks pc
    INNER JOIN public.clients c ON c.id = pc.client_id
    WHERE pc.id = pose_check_items.pose_check_id AND c.user_id = auth.uid()
  )
);
CREATE POLICY pose_check_items_delete_coach ON public.pose_check_items FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.pose_checks pc
    INNER JOIN public.clients c ON c.id = pc.client_id
    WHERE pc.id = pose_check_items.pose_check_id AND c.coach_id = auth.uid()
  )
);
CREATE POLICY pose_check_items_delete_client ON public.pose_check_items FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.pose_checks pc
    INNER JOIN public.clients c ON c.id = pc.client_id
    WHERE pc.id = pose_check_items.pose_check_id AND c.user_id = auth.uid()
  )
);
