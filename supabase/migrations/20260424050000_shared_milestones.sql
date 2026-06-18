-- Client-shared milestones (coach visibility) + optional coach copy + programme metadata for client timeline.

CREATE TABLE IF NOT EXISTS public.shared_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  milestone_key TEXT NOT NULL,
  milestone_label TEXT NOT NULL,
  shared_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_milestones_client_id ON public.shared_milestones(client_id);
CREATE INDEX IF NOT EXISTS idx_shared_milestones_shared_at ON public.shared_milestones(shared_at DESC);

ALTER TABLE public.shared_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shared_milestones_insert_own ON public.shared_milestones;
CREATE POLICY shared_milestones_insert_own ON public.shared_milestones
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS shared_milestones_select_scope ON public.shared_milestones;
CREATE POLICY shared_milestones_select_scope ON public.shared_milestones
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid())
    )
  );

GRANT SELECT, INSERT ON TABLE public.shared_milestones TO authenticated;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS milestone_client_celebration_note TEXT;
COMMENT ON COLUMN public.profiles.milestone_client_celebration_note IS 'Optional short message shown to clients when they unlock a milestone (celebration modal).';

ALTER TABLE public.program_weeks ADD COLUMN IF NOT EXISTS client_visible_week_note TEXT;
COMMENT ON COLUMN public.program_weeks.client_visible_week_note IS 'Coach note for this training week, visible to the assigned client.';

ALTER TABLE public.program_days ADD COLUMN IF NOT EXISTS phase_label TEXT;
COMMENT ON COLUMN public.program_days.phase_label IS 'Optional phase name for this day (e.g. Strength foundation), surfaced on client programme timeline.';
