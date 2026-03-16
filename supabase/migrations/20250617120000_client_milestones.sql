-- Client milestones: simple progress tracking for clients and coaches.
-- Types: first_checkin, first_workout_completed, seven_day_streak, weight_goal_hit, prep_week_entered, cardio_target_hit, coach_custom.

CREATE TABLE IF NOT EXISTS public.client_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  milestone_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT client_milestones_type_check CHECK (milestone_type IN (
    'first_checkin', 'first_workout_completed', 'seven_day_streak', 'weight_goal_hit',
    'prep_week_entered', 'cardio_target_hit', 'coach_custom'
  ))
);

CREATE INDEX IF NOT EXISTS client_milestones_client_id_idx ON public.client_milestones(client_id);
CREATE INDEX IF NOT EXISTS client_milestones_coach_id_idx ON public.client_milestones(coach_id);
CREATE INDEX IF NOT EXISTS client_milestones_achieved_at_idx ON public.client_milestones(achieved_at DESC);

COMMENT ON TABLE public.client_milestones IS 'Client progress milestones: first check-in, streaks, goals, prep, coach-custom. For client home and coach client detail.';

ALTER TABLE public.client_milestones ENABLE ROW LEVEL SECURITY;

-- Coach: see/edit milestones for their clients
DROP POLICY IF EXISTS client_milestones_select_coach ON public.client_milestones;
CREATE POLICY client_milestones_select_coach ON public.client_milestones
  FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE COALESCE(coach_id, trainer_id) = auth.uid()));

DROP POLICY IF EXISTS client_milestones_insert_coach ON public.client_milestones;
CREATE POLICY client_milestones_insert_coach ON public.client_milestones
  FOR INSERT WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE COALESCE(coach_id, trainer_id) = auth.uid()));

DROP POLICY IF EXISTS client_milestones_update_coach ON public.client_milestones;
CREATE POLICY client_milestones_update_coach ON public.client_milestones
  FOR UPDATE USING (client_id IN (SELECT id FROM public.clients WHERE COALESCE(coach_id, trainer_id) = auth.uid()));

DROP POLICY IF EXISTS client_milestones_delete_coach ON public.client_milestones;
CREATE POLICY client_milestones_delete_coach ON public.client_milestones
  FOR DELETE USING (client_id IN (SELECT id FROM public.clients WHERE COALESCE(coach_id, trainer_id) = auth.uid()));

-- Client: see own milestones only
DROP POLICY IF EXISTS client_milestones_select_client ON public.client_milestones;
CREATE POLICY client_milestones_select_client ON public.client_milestones
  FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
