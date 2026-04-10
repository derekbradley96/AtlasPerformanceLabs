-- Personal Basic: post-workout check-in fields + next-session adjustment blob on profile.

ALTER TABLE public.personal_checkins
  ADD COLUMN IF NOT EXISTS recovery INTEGER CHECK (recovery BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS performance INTEGER CHECK (performance BETWEEN 1 AND 5);

ALTER TABLE public.personal_checkins
  ADD COLUMN IF NOT EXISTS workout_session_id UUID REFERENCES public.workout_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_personal_checkins_session
  ON public.personal_checkins(workout_session_id)
  WHERE workout_session_id IS NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS personal_next_workout_adjustment jsonb;

COMMENT ON COLUMN public.profiles.personal_next_workout_adjustment IS 'Personal Basic: pending tweak for next assigned workout (sets_delta, message_key, etc.).';
