-- Programme block coach notes (client-visible timeline) + check-in review tags from coach.

ALTER TABLE public.program_blocks
  ADD COLUMN IF NOT EXISTS coach_notes TEXT;

COMMENT ON COLUMN public.program_blocks.coach_notes IS 'Free-text coach notes for this programme block / phase; newline-separated lines.';

ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS coach_review_tags TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.checkins.coach_review_tags IS 'Coach-applied review tags when marking a check-in reviewed (free-text chips).';
