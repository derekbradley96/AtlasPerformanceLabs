-- Link coaches (profiles) and clients to organisations and assigned coaches.
-- Adds assigned_coach_id on clients and backfills from coach_id, and ensures organisation_id
-- is wired through from coach profiles where available.

-- 1) Extend public.profiles with organisation_id (idempotent; may already exist from earlier migration)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.organisation_id IS 'Optional: organisation this profile (coach or staff) belongs to.';

-- Index for filtering profiles by organisation
CREATE INDEX IF NOT EXISTS profiles_organisation_id_idx
  ON public.profiles(organisation_id);


-- 2) Extend public.clients with organisation_id and assigned_coach_id
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_coach_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.clients.organisation_id IS 'Optional: organisation this client belongs to (for team/studio scoping).';
COMMENT ON COLUMN public.clients.assigned_coach_id IS 'Primary coach profile responsible for this client (does not replace legacy coach_id).';

-- Indexes for organisation + assigned coach lookup
CREATE INDEX IF NOT EXISTS clients_organisation_id_idx
  ON public.clients(organisation_id);

CREATE INDEX IF NOT EXISTS clients_assigned_coach_id_idx
  ON public.clients(assigned_coach_id);


-- 3) Backfill: assigned_coach_id from coach_id where safe
-- Only copy when assigned_coach_id is NULL and a matching profile exists.
UPDATE public.clients c
SET assigned_coach_id = c.coach_id
WHERE c.assigned_coach_id IS NULL
  AND c.coach_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = c.coach_id
  );


-- 4) Backfill: organisation_id on clients from their assigned coach's organisation
-- Only set when client.organisation_id is NULL (or already matches) and coach profile has an organisation_id.
UPDATE public.clients c
SET organisation_id = p.organisation_id
FROM public.profiles p
WHERE c.assigned_coach_id = p.id
  AND p.organisation_id IS NOT NULL
  AND (c.organisation_id IS NULL OR c.organisation_id = p.organisation_id);


-- Backfill summary (for docs):
-- - assigned_coach_id is populated from existing clients.coach_id only when:
--     * assigned_coach_id is currently NULL
--     * there is a corresponding row in public.profiles with id = coach_id
-- - clients.organisation_id is set from the coach profile's organisation_id only when:
--     * assigned_coach_id is not NULL
--     * the coach profile has organisation_id NOT NULL
--     * client.organisation_id is NULL or already equal to the coach's organisation_id
--
-- Assumptions:
-- - coach profiles live in public.profiles and use the same id as clients.coach_id.
-- - It is acceptable for some clients to have NULL assigned_coach_id if their coach_id
--   does not map cleanly to a profile (no profile row found).
-- - Existing coach_id, trainer_id, and any related triggers remain the source of truth
--   for legacy logic; assigned_coach_id is an explicit pointer to the primary coach profile
--   used by newer organisation-aware features.

