-- Coach markup on pose check item photos.

ALTER TABLE public.pose_check_items
  ADD COLUMN IF NOT EXISTS coach_annotations JSONB
    DEFAULT '[]'::jsonb;

ALTER TABLE public.pose_check_items
  ADD COLUMN IF NOT EXISTS annotated_image_path TEXT;

COMMENT ON COLUMN public.pose_check_items.coach_annotations IS 'Array of {x,y,radius,label,color} in image-normalized or canvas coordinates (see app).';
COMMENT ON COLUMN public.pose_check_items.annotated_image_path IS 'Optional rendered PNG path in pose_check_photos bucket.';
