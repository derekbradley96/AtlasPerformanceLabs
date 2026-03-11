-- On check-in insert: upsert client_compliance and create client_flags (low_compliance, rapid_weight_change).

CREATE OR REPLACE FUNCTION public.handle_checkin_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev_weight NUMERIC;
BEGIN
  -- SECURITY DEFINER runs as owner so trigger can write to client_compliance and client_flags.
  -- Insert into client_compliance (append row; table has no unique on client_id).
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

DROP TRIGGER IF EXISTS checkins_after_insert_trigger ON public.checkins;
CREATE TRIGGER checkins_after_insert_trigger
  AFTER INSERT ON public.checkins
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_checkin_submitted();

COMMENT ON FUNCTION public.handle_checkin_submitted() IS 'On checkin insert: append client_compliance row; create client_flags for low_compliance and rapid_weight_change if no unresolved duplicate.';
