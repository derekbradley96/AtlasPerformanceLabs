-- Owning coach on program_blocks (profiles.id). Some environments require this on every row.
-- Personal blocks: coach_id = owner_profile_id = auth uid.

ALTER TABLE public.program_blocks
  ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.program_blocks pb
SET coach_id = pb.owner_profile_id
WHERE pb.coach_id IS NULL AND pb.owner_profile_id IS NOT NULL;

UPDATE public.program_blocks pb
SET coach_id = COALESCE(c.coach_id, c.trainer_id)
FROM public.clients c
WHERE pb.client_id = c.id
  AND pb.coach_id IS NULL
  AND COALESCE(c.coach_id, c.trainer_id) IS NOT NULL;

COMMENT ON COLUMN public.program_blocks.coach_id IS 'Owning coach profile id. Personal-owned blocks: same as owner_profile_id.';
