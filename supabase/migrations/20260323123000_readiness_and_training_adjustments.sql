-- Readiness + adaptive training recommendation data model.
-- Adds:
-- 1) public.readiness_checkins
-- 2) public.training_adjustment_recommendations

CREATE TABLE IF NOT EXISTS public.readiness_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  sleep_score INTEGER NOT NULL,
  fatigue_score INTEGER NOT NULL,
  soreness_score INTEGER NOT NULL,
  stress_score INTEGER NOT NULL,
  motivation_score INTEGER NOT NULL,
  readiness_score INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.training_adjustment_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_id UUID,
  recommendation_type TEXT NOT NULL
    CHECK (
      recommendation_type IN (
        'keep_as_is',
        'reduce_volume',
        'reduce_intensity',
        'recovery_session',
        'deload_recommendation'
      )
    ),
  severity TEXT NOT NULL
    CHECK (severity IN ('low', 'medium', 'high')),
  title TEXT NOT NULL,
  description TEXT,
  adjustment_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'applied', 'ignored')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Readiness indexes
CREATE INDEX IF NOT EXISTS idx_readiness_checkins_client_created_at
  ON public.readiness_checkins(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_readiness_checkins_profile_created_at
  ON public.readiness_checkins(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_readiness_checkins_created_at
  ON public.readiness_checkins(created_at DESC);

-- Recommendation indexes
CREATE INDEX IF NOT EXISTS idx_training_adjustments_client_status_created_at
  ON public.training_adjustment_recommendations(client_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_training_adjustments_coach_status_created_at
  ON public.training_adjustment_recommendations(coach_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_training_adjustments_type_severity
  ON public.training_adjustment_recommendations(recommendation_type, severity);
CREATE INDEX IF NOT EXISTS idx_training_adjustments_session_id
  ON public.training_adjustment_recommendations(session_id);
CREATE INDEX IF NOT EXISTS idx_training_adjustments_created_at
  ON public.training_adjustment_recommendations(created_at DESC);
