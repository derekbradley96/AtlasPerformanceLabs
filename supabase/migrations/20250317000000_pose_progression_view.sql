-- Pose progression timeline: one row per pose per pose check for coaches to compare conditioning across prep weeks.
-- Sources: pose_check_items, pose_checks, contest_preps.
-- week_out = floor((show_date - submitted_at) / 7). Query with ORDER BY pose_key, submitted_at for timeline order.

DROP VIEW IF EXISTS public.v_pose_progression;

CREATE VIEW public.v_pose_progression
WITH (security_invoker = on)
AS
SELECT
  pc.client_id,
  pci.pose_key,
  pci.pose_label,
  pc.id AS pose_check_id,
  pc.submitted_at,
  (floor(((cp.show_date - (pc.submitted_at::date))::numeric) / 7)::integer) AS week_out,
  pci.photo_path
FROM public.pose_check_items pci
JOIN public.pose_checks pc ON pc.id = pci.pose_check_id
LEFT JOIN public.contest_preps cp ON cp.id = pc.prep_id;

COMMENT ON VIEW public.v_pose_progression IS 'Pose progression timeline: client_id, pose_key, pose_label, pose_check_id, submitted_at, week_out (weeks before show_date), photo_path. Order by pose_key, submitted_at when selecting.';
