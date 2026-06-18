-- Fix check-in trigger compatibility with mixed client_compliance schemas.
-- Some environments require coach_id/week_start/training_adherence/nutrition_adherence/checkin_submitted,
-- while older environments only have training_adherence_pct/nutrition_adherence_pct + recorded_at.
-- This trigger handles both shapes and never blocks check-in submission if compliance insert fails.

CREATE OR REPLACE FUNCTION public.handle_checkin_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev_weight NUMERIC;
  v_coach_id UUID;
  v_week_start DATE;
BEGIN
  -- Derive coach id safely from checkin row payload first, then fallback to clients linkage.
  v_coach_id := COALESCE(
    NULLIF(to_jsonb(NEW)->>'coach_id', '')::uuid,
    NULLIF(to_jsonb(NEW)->>'trainer_id', '')::uuid
  );
  IF v_coach_id IS NULL THEN
    SELECT COALESCE(c.coach_id, c.trainer_id)
    INTO v_coach_id
    FROM public.clients c
    WHERE c.id = NEW.client_id;
  END IF;

  v_week_start := COALESCE(
    NULLIF(to_jsonb(NEW)->>'week_start', '')::date,
    date_trunc('week', COALESCE(NEW.submitted_at, now()))::date
  );

  -- Try modern compliance schema first; if unavailable, fallback to legacy schema.
  BEGIN
    INSERT INTO public.client_compliance (
      client_id,
      coach_id,
      week_start,
      training_adherence,
      nutrition_adherence,
      checkin_submitted,
      notes,
      recorded_at,
      training_adherence_pct,
      nutrition_adherence_pct
    ) VALUES (
      NEW.client_id,
      v_coach_id,
      v_week_start,
      COALESCE(NEW.training_completion, 0),
      COALESCE(NEW.nutrition_adherence, 0),
      true,
      NULL,
      COALESCE(NEW.submitted_at, now()),
      NEW.training_completion,
      NEW.nutrition_adherence
    );
  EXCEPTION
    WHEN undefined_column THEN
      BEGIN
        INSERT INTO public.client_compliance (
          client_id,
          recorded_at,
          training_adherence_pct,
          nutrition_adherence_pct,
          notes
        ) VALUES (
          NEW.client_id,
          COALESCE(NEW.submitted_at, now()),
          NEW.training_completion,
          NEW.nutrition_adherence,
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'client_compliance legacy insert skipped: %', SQLERRM;
      END;
    WHEN not_null_violation THEN
      RAISE NOTICE 'client_compliance modern insert skipped (not-null): %', SQLERRM;
    WHEN OTHERS THEN
      RAISE NOTICE 'client_compliance insert skipped: %', SQLERRM;
  END;

  -- Low-compliance flag: any of training_completion, nutrition_adherence, cardio_completion < 60
  IF (NEW.training_completion IS NOT NULL AND NEW.training_completion < 60)
     OR (NEW.nutrition_adherence IS NOT NULL AND NEW.nutrition_adherence < 60)
     OR (NEW.cardio_completion IS NOT NULL AND NEW.cardio_completion < 60) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.client_flags
      WHERE client_id = NEW.client_id AND resolved_at IS NULL AND label = 'low_compliance'
    ) THEN
      INSERT INTO public.client_flags (client_id, severity, label)
      VALUES (NEW.client_id, 'medium', 'low_compliance');
    END IF;
  END IF;

  -- Rapid weight change: |weight - previous weight| > 2.0
  IF NEW.weight IS NOT NULL THEN
    SELECT c.weight INTO prev_weight
    FROM public.checkins c
    WHERE c.client_id = NEW.client_id AND c.id <> NEW.id
    ORDER BY c.submitted_at DESC NULLS LAST
    LIMIT 1;
    IF prev_weight IS NOT NULL AND abs(NEW.weight - prev_weight) > 2.0 THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.client_flags
        WHERE client_id = NEW.client_id AND resolved_at IS NULL AND label = 'rapid_weight_change'
      ) THEN
        INSERT INTO public.client_flags (client_id, severity, label)
        VALUES (NEW.client_id, 'high', 'rapid_weight_change');
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
