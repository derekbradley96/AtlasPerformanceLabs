-- Training intelligence extensions:
-- - ensure workout_logs/checkins/client_state exist
-- - extend client_state with fatigue/adherence/performance fields
-- - evaluate_client_state(client_id) updates + returns current recommendation

CREATE TABLE IF NOT EXISTS public.workout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.workout_sessions(id) ON DELETE SET NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_sets INTEGER NOT NULL DEFAULT 0,
  completed_sets INTEGER NOT NULL DEFAULT 0,
  avg_reps NUMERIC,
  avg_weight NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_workout_logs_client_logged_at
  ON public.workout_logs(client_id, logged_at DESC);

ALTER TABLE public.client_state
  ADD COLUMN IF NOT EXISTS fatigue_score INTEGER,
  ADD COLUMN IF NOT EXISTS adherence_score NUMERIC,
  ADD COLUMN IF NOT EXISTS performance_trend TEXT,
  ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ;

ALTER TABLE public.client_state
  ALTER COLUMN last_updated SET DEFAULT now();

ALTER TABLE public.client_state
  DROP CONSTRAINT IF EXISTS client_state_performance_trend_check;

ALTER TABLE public.client_state
  ADD CONSTRAINT client_state_performance_trend_check
  CHECK (
    performance_trend IS NULL
    OR performance_trend IN ('improving', 'stable', 'declining')
  );

CREATE OR REPLACE FUNCTION public.sync_workout_log_from_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
  v_total_sets INTEGER := 0;
  v_completed_sets INTEGER := 0;
  v_avg_reps NUMERIC := NULL;
  v_avg_weight NUMERIC := NULL;
BEGIN
  IF NEW.status IS DISTINCT FROM 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT ws.client_id INTO v_client_id
  FROM public.workout_sessions ws
  WHERE ws.id = NEW.id;

  IF v_client_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE completed = true)::INTEGER,
    AVG(reps_done),
    AVG(weight_done)
  INTO
    v_total_sets,
    v_completed_sets,
    v_avg_reps,
    v_avg_weight
  FROM public.workout_session_sets
  WHERE session_id = NEW.id;

  INSERT INTO public.workout_logs (
    client_id,
    session_id,
    logged_at,
    total_sets,
    completed_sets,
    avg_reps,
    avg_weight
  )
  VALUES (
    v_client_id,
    NEW.id,
    COALESCE(NEW.completed_at, now()),
    COALESCE(v_total_sets, 0),
    COALESCE(v_completed_sets, 0),
    v_avg_reps,
    v_avg_weight
  )
  ON CONFLICT (session_id) DO UPDATE SET
    logged_at = EXCLUDED.logged_at,
    total_sets = EXCLUDED.total_sets,
    completed_sets = EXCLUDED.completed_sets,
    avg_reps = EXCLUDED.avg_reps,
    avg_weight = EXCLUDED.avg_weight;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workout_logs_session_id_unique'
      AND conrelid = 'public.workout_logs'::regclass
  ) THEN
    ALTER TABLE public.workout_logs
      ADD CONSTRAINT workout_logs_session_id_unique UNIQUE (session_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_sync_workout_log_from_session ON public.workout_sessions;
CREATE TRIGGER trg_sync_workout_log_from_session
AFTER INSERT OR UPDATE OF status, completed_at ON public.workout_sessions
FOR EACH ROW
EXECUTE FUNCTION public.sync_workout_log_from_session();

CREATE OR REPLACE FUNCTION public.evaluate_client_state(p_client_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coach_id UUID;
  v_coach_focus TEXT := 'transformation';
  v_sleep NUMERIC := 5;
  v_stress NUMERIC := 5;
  v_energy NUMERIC := 5;
  v_missed_workouts INTEGER := 0;
  v_fatigue_score INTEGER := 5;
  v_adherence_score NUMERIC := 0;
  v_prev_avg_reps NUMERIC := NULL;
  v_curr_avg_reps NUMERIC := NULL;
  v_prev_avg_weight NUMERIC := NULL;
  v_curr_avg_weight NUMERIC := NULL;
  v_performance_trend TEXT := 'stable';
  v_suggested_action TEXT := 'keep_as_is';
  v_recommendation_type TEXT := 'keep_as_is';
  v_severity TEXT := 'low';
  v_title TEXT := 'Keep session as planned';
  v_description TEXT := 'Readiness and performance are stable.';
  v_payload JSONB := '{}'::jsonb;
BEGIN
  IF p_client_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'client_id_required');
  END IF;

  SELECT COALESCE(c.coach_id, c.trainer_id) INTO v_coach_id
  FROM public.clients c
  WHERE c.id = p_client_id;

  IF v_coach_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(lower(trim(p.coach_focus)), ''), 'transformation')
    INTO v_coach_focus
    FROM public.profiles p
    WHERE p.id = v_coach_id;
  END IF;

  SELECT
    COALESCE(ch.sleep_score, 5),
    COALESCE(ch.energy_level, 5)
  INTO v_sleep, v_energy
  FROM public.checkins ch
  WHERE ch.client_id = p_client_id
  ORDER BY ch.submitted_at DESC NULLS LAST
  LIMIT 1;

  SELECT
    COALESCE(rc.stress_score, 3)
  INTO v_stress
  FROM public.readiness_checkins rc
  WHERE rc.client_id = p_client_id
  ORDER BY rc.created_at DESC
  LIMIT 1;

  SELECT GREATEST(0, 3 - COUNT(*)::INTEGER)
  INTO v_missed_workouts
  FROM public.workout_logs wl
  WHERE wl.client_id = p_client_id
    AND wl.logged_at >= (now() - interval '7 days');

  v_fatigue_score :=
    LEAST(
      10,
      GREATEST(
        0,
        ROUND(
          ((10 - LEAST(10, GREATEST(1, v_sleep))) * 0.25)
          + (LEAST(10, GREATEST(1, v_stress)) * 0.30)
          + ((10 - LEAST(10, GREATEST(1, v_energy))) * 0.30)
          + (LEAST(3, GREATEST(0, v_missed_workouts)) * 0.5)
        )::INTEGER
      )
    );

  SELECT
    COALESCE(AVG(
      (COALESCE(training_adherence_pct, 0) + COALESCE(nutrition_adherence_pct, 0))
      / NULLIF(
          (CASE WHEN training_adherence_pct IS NOT NULL THEN 1 ELSE 0 END)
          + (CASE WHEN nutrition_adherence_pct IS NOT NULL THEN 1 ELSE 0 END),
          0
        )
    ), 0)
  INTO v_adherence_score
  FROM public.client_compliance cc
  WHERE cc.client_id = p_client_id
    AND cc.recorded_at >= (now() - interval '14 days');

  WITH recent_logs AS (
    SELECT wl.avg_reps, wl.avg_weight, wl.logged_at,
      row_number() OVER (ORDER BY wl.logged_at DESC) AS rn
    FROM public.workout_logs wl
    WHERE wl.client_id = p_client_id
      AND wl.logged_at >= (now() - interval '30 days')
    ORDER BY wl.logged_at DESC
    LIMIT 4
  )
  SELECT
    AVG(CASE WHEN rn IN (3,4) THEN avg_reps END),
    AVG(CASE WHEN rn IN (1,2) THEN avg_reps END),
    AVG(CASE WHEN rn IN (3,4) THEN avg_weight END),
    AVG(CASE WHEN rn IN (1,2) THEN avg_weight END)
  INTO v_prev_avg_reps, v_curr_avg_reps, v_prev_avg_weight, v_curr_avg_weight
  FROM recent_logs;

  IF v_curr_avg_reps IS NOT NULL AND v_prev_avg_reps IS NOT NULL THEN
    IF (v_curr_avg_reps - v_prev_avg_reps) >= 0.5
      OR (COALESCE(v_curr_avg_weight, 0) - COALESCE(v_prev_avg_weight, 0)) >= 1 THEN
      v_performance_trend := 'improving';
    ELSIF (v_prev_avg_reps - v_curr_avg_reps) >= 0.5
      OR (COALESCE(v_prev_avg_weight, 0) - COALESCE(v_curr_avg_weight, 0)) >= 1 THEN
      v_performance_trend := 'declining';
    ELSE
      v_performance_trend := 'stable';
    END IF;
  END IF;

  IF v_fatigue_score >= 7 THEN
    v_recommendation_type := 'reduce_volume';
    v_severity := 'high';
    v_suggested_action := 'reduce_volume_and_increase_rest';
    v_title := 'High fatigue detected';
    v_description := 'Reduce total volume and increase rest time for today.';
    v_payload := jsonb_build_object(
      'action', 'reduce_volume',
      'set_adjustment', jsonb_build_object('type', 'decrease_working_sets', 'delta', -1),
      'rest_adjustment_seconds', 30
    );
  ELSIF v_fatigue_score <= 3 AND v_performance_trend = 'improving' THEN
    v_recommendation_type := 'keep_as_is';
    v_severity := 'low';
    v_suggested_action := 'progression';
    v_title := 'Ready to progress';
    v_description := 'Low fatigue and improving performance suggest progression.';
    v_payload := jsonb_build_object(
      'action', 'progression',
      'set_adjustment', jsonb_build_object('type', 'increase_working_sets', 'delta', 1),
      'rest_adjustment_seconds', -15
    );
  ELSIF v_performance_trend = 'declining' THEN
    v_recommendation_type := 'deload_recommendation';
    v_severity := 'medium';
    v_suggested_action := 'deload_or_adjustment';
    v_title := 'Performance trend declining';
    v_description := 'Recommend deload or targeted adjustment to restore momentum.';
    v_payload := jsonb_build_object(
      'action', 'deload',
      'set_adjustment', jsonb_build_object('type', 'decrease_working_sets', 'delta', -1),
      'rest_adjustment_seconds', 30
    );
  END IF;

  -- Coach-type aware weighting
  IF v_coach_focus = 'transformation' THEN
    IF v_adherence_score < 60 THEN
      v_title := 'Adherence-first adjustment';
      v_description := 'Prioritize sustainable adherence before aggressive progression.';
    END IF;
  ELSIF v_coach_focus = 'competition' THEN
    IF v_fatigue_score >= 6 THEN
      v_title := 'Recovery and muscle retention priority';
      v_description := 'Manage fatigue to preserve performance and muscle retention.';
    END IF;
  ELSIF v_coach_focus = 'integrated' THEN
    v_description := v_description || ' Integrated mode balances adherence and recovery.';
  END IF;

  INSERT INTO public.client_state (
    client_id,
    coach_id,
    fatigue_score,
    adherence_score,
    performance_trend,
    last_updated,
    updated_at
  )
  VALUES (
    p_client_id,
    v_coach_id,
    v_fatigue_score,
    v_adherence_score,
    v_performance_trend,
    now(),
    now()
  )
  ON CONFLICT (client_id) DO UPDATE SET
    coach_id = EXCLUDED.coach_id,
    fatigue_score = EXCLUDED.fatigue_score,
    adherence_score = EXCLUDED.adherence_score,
    performance_trend = EXCLUDED.performance_trend,
    last_updated = now(),
    updated_at = now();

  IF v_coach_id IS NOT NULL AND v_recommendation_type <> 'keep_as_is' THEN
    INSERT INTO public.training_adjustment_recommendations (
      client_id,
      coach_id,
      session_id,
      recommendation_type,
      severity,
      title,
      description,
      adjustment_payload,
      status
    )
    VALUES (
      p_client_id,
      v_coach_id,
      NULL,
      v_recommendation_type,
      v_severity,
      v_title,
      v_description,
      jsonb_set(v_payload, '{meta}', jsonb_build_object(
        'fatigue_score', v_fatigue_score,
        'adherence_score', v_adherence_score,
        'performance_trend', v_performance_trend,
        'coach_focus', v_coach_focus
      ), true),
      'pending'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'client_id', p_client_id,
    'coach_focus', v_coach_focus,
    'fatigue_score', v_fatigue_score,
    'adherence_score', v_adherence_score,
    'performance_trend', v_performance_trend,
    'suggested_action', v_suggested_action,
    'recommendation_type', v_recommendation_type
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_client_state(UUID) TO authenticated;

