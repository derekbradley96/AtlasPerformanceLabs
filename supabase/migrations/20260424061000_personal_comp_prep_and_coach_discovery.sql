-- Solo competition prep: protocol-backed prep row per profile + coach discovery prompt timestamp.

CREATE TABLE IF NOT EXISTS public.personal_contest_preps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  protocol_id TEXT NOT NULL,
  prep_started_at DATE NOT NULL DEFAULT CURRENT_DATE,
  show_date DATE NOT NULL,
  show_name TEXT,
  federation TEXT,
  division TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  protocol_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS personal_contest_preps_one_active_per_profile
  ON public.personal_contest_preps(profile_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS personal_contest_preps_profile_id_idx ON public.personal_contest_preps(profile_id);

ALTER TABLE public.personal_contest_preps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS personal_contest_preps_select_own ON public.personal_contest_preps;
CREATE POLICY personal_contest_preps_select_own ON public.personal_contest_preps
  FOR SELECT TO authenticated
  USING (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS personal_contest_preps_insert_own ON public.personal_contest_preps;
CREATE POLICY personal_contest_preps_insert_own ON public.personal_contest_preps
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS personal_contest_preps_update_own ON public.personal_contest_preps;
CREATE POLICY personal_contest_preps_update_own ON public.personal_contest_preps
  FOR UPDATE TO authenticated
  USING (profile_id = (SELECT auth.uid()))
  WITH CHECK (profile_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE ON TABLE public.personal_contest_preps TO authenticated;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coach_discovery_prompt_seen_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.coach_discovery_prompt_seen_at IS 'When set, the 6–10 weeks-out coach discovery card on Today was dismissed; Progress shows a smaller CTA.';

ALTER TABLE public.coach_marketplace_profiles
  ADD COLUMN IF NOT EXISTS divisions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

COMMENT ON COLUMN public.coach_marketplace_profiles.divisions IS 'Optional division labels (e.g. Bikini, Figure) for marketplace filtering; empty means not specified.';
