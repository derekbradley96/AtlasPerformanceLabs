-- Security Advisor follow-up:
-- 1) Legacy canonical tables (trainers FK) + intelligence tables without RLS
-- 2) security_invoker on habit_logs + v_client_master_dashboard (Postgres 15+)

-- -----------------------------------------------------------------------------
-- Helper: legacy Motion tables use trainers.id; trainers.user_id is TEXT = auth uid.
-- PL/pgSQL + dynamic SQL so this migration applies even when public.trainers was
-- never created on a project (function returns false in that case).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_owns_legacy_trainer(p_trainer_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
BEGIN
  IF p_trainer_id IS NULL OR to_regclass('public.trainers') IS NULL THEN
    RETURN false;
  END IF;
  EXECUTE $dyn$
    SELECT EXISTS (
      SELECT 1
      FROM public.trainers t
      WHERE t.id = $1
        AND trim(t.user_id) = trim($2::text)
    )
  $dyn$
  INTO v_ok
  USING p_trainer_id, (auth.uid())::text;
  RETURN COALESCE(v_ok, false);
END;
$$;

COMMENT ON FUNCTION public.current_user_owns_legacy_trainer(uuid) IS
  'True when the current auth user owns the given trainers.id row (trainers.user_id matches auth.uid() as text). Returns false if public.trainers does not exist.';

-- -----------------------------------------------------------------------------
-- Legacy canonical tables (optional on some remotes): skip entire block if absent
-- -----------------------------------------------------------------------------

DO $rls$
BEGIN
  IF to_regclass('public.lifts') IS NULL THEN
    RAISE NOTICE 'Skipping RLS: public.lifts does not exist';
  ELSE
  ALTER TABLE public.lifts ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS lifts_select_coach_or_client ON public.lifts;
  CREATE POLICY lifts_select_coach_or_client ON public.lifts
    FOR SELECT USING (
      public.current_user_owns_client(client_id)
      OR EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = lifts.client_id AND c.user_id = auth.uid()
      )
    );
  DROP POLICY IF EXISTS lifts_insert_coach ON public.lifts;
  CREATE POLICY lifts_insert_coach ON public.lifts
    FOR INSERT WITH CHECK (public.current_user_owns_client(client_id));
  DROP POLICY IF EXISTS lifts_update_coach ON public.lifts;
  CREATE POLICY lifts_update_coach ON public.lifts
    FOR UPDATE USING (public.current_user_owns_client(client_id))
    WITH CHECK (public.current_user_owns_client(client_id));
  DROP POLICY IF EXISTS lifts_delete_coach ON public.lifts;
  CREATE POLICY lifts_delete_coach ON public.lifts
    FOR DELETE USING (public.current_user_owns_client(client_id));
  END IF;
END;
$rls$;

DO $rls$
BEGIN
  IF to_regclass('public.invoices') IS NULL THEN
    RAISE NOTICE 'Skipping RLS: public.invoices does not exist';
  ELSE
  ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS invoices_select_coach_or_client ON public.invoices;
  CREATE POLICY invoices_select_coach_or_client ON public.invoices
    FOR SELECT USING (
      public.current_user_owns_legacy_trainer(trainer_id)
      OR EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = invoices.client_id AND c.user_id = auth.uid()
      )
    );
  DROP POLICY IF EXISTS invoices_write_trainer ON public.invoices;
  CREATE POLICY invoices_write_trainer ON public.invoices
    FOR INSERT WITH CHECK (public.current_user_owns_legacy_trainer(trainer_id));
  DROP POLICY IF EXISTS invoices_update_trainer ON public.invoices;
  CREATE POLICY invoices_update_trainer ON public.invoices
    FOR UPDATE USING (public.current_user_owns_legacy_trainer(trainer_id))
    WITH CHECK (public.current_user_owns_legacy_trainer(trainer_id));
  DROP POLICY IF EXISTS invoices_delete_trainer ON public.invoices;
  CREATE POLICY invoices_delete_trainer ON public.invoices
    FOR DELETE USING (public.current_user_owns_legacy_trainer(trainer_id));
  END IF;
END;
$rls$;

DO $rls$
BEGIN
  IF to_regclass('public.leads') IS NULL THEN
    RAISE NOTICE 'Skipping RLS: public.leads does not exist';
  ELSE
  ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS leads_all_trainer ON public.leads;
  CREATE POLICY leads_all_trainer ON public.leads
    FOR ALL USING (public.current_user_owns_legacy_trainer(trainer_id))
    WITH CHECK (public.current_user_owns_legacy_trainer(trainer_id));
  END IF;
END;
$rls$;

DO $rls$
BEGIN
  IF to_regclass('public.programs') IS NULL
     OR to_regclass('public.program_assignments') IS NULL THEN
    RAISE NOTICE 'Skipping RLS: public.programs / program_assignments missing';
  ELSE
  ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS programs_select_scope ON public.programs;
  CREATE POLICY programs_select_scope ON public.programs
    FOR SELECT USING (
      public.current_user_owns_legacy_trainer(trainer_id)
      OR EXISTS (
        SELECT 1
        FROM public.program_assignments pa
        JOIN public.clients cl ON cl.id = pa.client_id
        WHERE pa.program_id = programs.id
          AND (
            public.current_user_owns_client(cl.id)
            OR cl.user_id = auth.uid()
          )
      )
    );
  DROP POLICY IF EXISTS programs_write_trainer ON public.programs;
  CREATE POLICY programs_write_trainer ON public.programs
    FOR INSERT WITH CHECK (public.current_user_owns_legacy_trainer(trainer_id));
  DROP POLICY IF EXISTS programs_update_trainer ON public.programs;
  CREATE POLICY programs_update_trainer ON public.programs
    FOR UPDATE USING (public.current_user_owns_legacy_trainer(trainer_id))
    WITH CHECK (public.current_user_owns_legacy_trainer(trainer_id));
  DROP POLICY IF EXISTS programs_delete_trainer ON public.programs;
  CREATE POLICY programs_delete_trainer ON public.programs
    FOR DELETE USING (public.current_user_owns_legacy_trainer(trainer_id));
  END IF;
END;
$rls$;

DO $rls$
BEGIN
  IF to_regclass('public.program_assignments') IS NULL THEN
    RAISE NOTICE 'Skipping RLS: public.program_assignments does not exist';
  ELSE
  ALTER TABLE public.program_assignments ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS program_assignments_select_coach_or_client ON public.program_assignments;
  CREATE POLICY program_assignments_select_coach_or_client ON public.program_assignments
    FOR SELECT USING (
      public.current_user_owns_client(client_id)
      OR EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = program_assignments.client_id AND c.user_id = auth.uid()
      )
    );
  DROP POLICY IF EXISTS program_assignments_write_coach ON public.program_assignments;
  CREATE POLICY program_assignments_write_coach ON public.program_assignments
    FOR INSERT WITH CHECK (public.current_user_owns_client(client_id));
  DROP POLICY IF EXISTS program_assignments_update_coach ON public.program_assignments;
  CREATE POLICY program_assignments_update_coach ON public.program_assignments
    FOR UPDATE USING (public.current_user_owns_client(client_id))
    WITH CHECK (public.current_user_owns_client(client_id));
  DROP POLICY IF EXISTS program_assignments_delete_coach ON public.program_assignments;
  CREATE POLICY program_assignments_delete_coach ON public.program_assignments
    FOR DELETE USING (public.current_user_owns_client(client_id));
  END IF;
END;
$rls$;

DO $rls$
BEGIN
  IF to_regclass('public.milestones') IS NULL THEN
    RAISE NOTICE 'Skipping RLS: public.milestones does not exist';
  ELSE
  ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS milestones_select_coach_or_client ON public.milestones;
  CREATE POLICY milestones_select_coach_or_client ON public.milestones
    FOR SELECT USING (
      public.current_user_owns_client(client_id)
      OR EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = milestones.client_id AND c.user_id = auth.uid()
      )
    );
  DROP POLICY IF EXISTS milestones_write_coach ON public.milestones;
  CREATE POLICY milestones_write_coach ON public.milestones
    FOR INSERT WITH CHECK (public.current_user_owns_client(client_id));
  DROP POLICY IF EXISTS milestones_update_coach ON public.milestones;
  CREATE POLICY milestones_update_coach ON public.milestones
    FOR UPDATE USING (public.current_user_owns_client(client_id))
    WITH CHECK (public.current_user_owns_client(client_id));
  DROP POLICY IF EXISTS milestones_delete_coach ON public.milestones;
  CREATE POLICY milestones_delete_coach ON public.milestones
    FOR DELETE USING (public.current_user_owns_client(client_id));
  END IF;
END;
$rls$;

DO $rls$
BEGIN
  IF to_regclass('public.closeouts') IS NULL THEN
    RAISE NOTICE 'Skipping RLS: public.closeouts does not exist';
  ELSE
  ALTER TABLE public.closeouts ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS closeouts_all_trainer ON public.closeouts;
  CREATE POLICY closeouts_all_trainer ON public.closeouts
    FOR ALL USING (public.current_user_owns_legacy_trainer(trainer_id))
    WITH CHECK (public.current_user_owns_legacy_trainer(trainer_id));
  END IF;
END;
$rls$;

-- -----------------------------------------------------------------------------
-- atlas_retention_review_items (coach_id = auth uid per table comment)
-- -----------------------------------------------------------------------------
ALTER TABLE public.atlas_retention_review_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS atlas_retention_review_items_select_coach ON public.atlas_retention_review_items;
CREATE POLICY atlas_retention_review_items_select_coach ON public.atlas_retention_review_items
  FOR SELECT USING (coach_id = auth.uid());

DROP POLICY IF EXISTS atlas_retention_review_items_insert_coach ON public.atlas_retention_review_items;
CREATE POLICY atlas_retention_review_items_insert_coach ON public.atlas_retention_review_items
  FOR INSERT WITH CHECK (
    coach_id = auth.uid()
    AND public.current_user_owns_client(client_id)
  );

DROP POLICY IF EXISTS atlas_retention_review_items_update_coach ON public.atlas_retention_review_items;
CREATE POLICY atlas_retention_review_items_update_coach ON public.atlas_retention_review_items
  FOR UPDATE USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS atlas_retention_review_items_delete_coach ON public.atlas_retention_review_items;
CREATE POLICY atlas_retention_review_items_delete_coach ON public.atlas_retention_review_items
  FOR DELETE USING (coach_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Pose catalog: read for signed-in users only
-- -----------------------------------------------------------------------------
ALTER TABLE public.pose_division_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pose_template_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pose_division_templates_select_auth ON public.pose_division_templates;
CREATE POLICY pose_division_templates_select_auth ON public.pose_division_templates
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS pose_template_items_select_auth ON public.pose_template_items;
CREATE POLICY pose_template_items_select_auth ON public.pose_template_items
  FOR SELECT TO authenticated
  USING (true);

-- -----------------------------------------------------------------------------
-- atlas_invoice_fees (coach_id -> atlas_coaches)
-- -----------------------------------------------------------------------------
ALTER TABLE public.atlas_invoice_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS atlas_invoice_fees_select_own_coach ON public.atlas_invoice_fees;
CREATE POLICY atlas_invoice_fees_select_own_coach ON public.atlas_invoice_fees
  FOR SELECT USING (
    coach_id IN (
      SELECT ac.id FROM public.atlas_coaches ac
      WHERE ac.user_id = (auth.uid())::text
    )
  );

-- Webhook uses service_role (bypasses RLS). No authenticated INSERT/UPDATE policies.

-- -----------------------------------------------------------------------------
-- profile_creation_errors (optional table — some projects only)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.profile_creation_errors') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.profile_creation_errors ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS profile_creation_errors_admin_select ON public.profile_creation_errors';
    EXECUTE $p$
      CREATE POLICY profile_creation_errors_admin_select ON public.profile_creation_errors
      FOR SELECT USING (public.current_user_is_admin())
    $p$;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- readiness_checkins (client_id and/or profile_id personal rows)
-- -----------------------------------------------------------------------------
ALTER TABLE public.readiness_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS readiness_checkins_select_scope ON public.readiness_checkins;
CREATE POLICY readiness_checkins_select_scope ON public.readiness_checkins
  FOR SELECT USING (
    (profile_id IS NOT NULL AND profile_id = auth.uid())
    OR (
      client_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM public.clients c
          WHERE c.id = readiness_checkins.client_id AND c.user_id = auth.uid()
        )
        OR public.current_user_owns_client(client_id)
      )
    )
  );

DROP POLICY IF EXISTS readiness_checkins_insert_scope ON public.readiness_checkins;
CREATE POLICY readiness_checkins_insert_scope ON public.readiness_checkins
  FOR INSERT WITH CHECK (
    (profile_id IS NOT NULL AND profile_id = auth.uid() AND client_id IS NULL)
    OR (
      client_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = readiness_checkins.client_id AND c.user_id = auth.uid()
      )
    )
    OR (
      client_id IS NOT NULL AND public.current_user_owns_client(client_id)
    )
  );

DROP POLICY IF EXISTS readiness_checkins_update_scope ON public.readiness_checkins;
CREATE POLICY readiness_checkins_update_scope ON public.readiness_checkins
  FOR UPDATE USING (
    (profile_id IS NOT NULL AND profile_id = auth.uid())
    OR public.current_user_owns_client(client_id)
  )
  WITH CHECK (
    (profile_id IS NOT NULL AND profile_id = auth.uid())
    OR public.current_user_owns_client(client_id)
  );

DROP POLICY IF EXISTS readiness_checkins_delete_scope ON public.readiness_checkins;
CREATE POLICY readiness_checkins_delete_scope ON public.readiness_checkins
  FOR DELETE USING (
    (profile_id IS NOT NULL AND profile_id = auth.uid())
    OR public.current_user_owns_client(client_id)
  );

-- -----------------------------------------------------------------------------
-- training_adjustment_recommendations (coach_id -> profiles.id, typically = auth.uid())
-- -----------------------------------------------------------------------------
ALTER TABLE public.training_adjustment_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS training_adjustment_recommendations_select_scope ON public.training_adjustment_recommendations;
CREATE POLICY training_adjustment_recommendations_select_scope ON public.training_adjustment_recommendations
  FOR SELECT USING (
    (coach_id IS NOT NULL AND coach_id = auth.uid())
    OR (
      client_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM public.clients c
          WHERE c.id = training_adjustment_recommendations.client_id AND c.user_id = auth.uid()
        )
        OR public.current_user_owns_client(client_id)
      )
    )
  );

DROP POLICY IF EXISTS training_adjustment_recommendations_insert_scope ON public.training_adjustment_recommendations;
CREATE POLICY training_adjustment_recommendations_insert_scope ON public.training_adjustment_recommendations
  FOR INSERT WITH CHECK (
    (
      client_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = training_adjustment_recommendations.client_id AND c.user_id = auth.uid()
      )
    )
    OR (
      client_id IS NOT NULL AND public.current_user_owns_client(client_id)
    )
  );

DROP POLICY IF EXISTS training_adjustment_recommendations_update_scope ON public.training_adjustment_recommendations;
CREATE POLICY training_adjustment_recommendations_update_scope ON public.training_adjustment_recommendations
  FOR UPDATE USING (
    (coach_id IS NOT NULL AND coach_id = auth.uid())
    OR (
      client_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = training_adjustment_recommendations.client_id AND c.user_id = auth.uid()
      )
    )
    OR public.current_user_owns_client(client_id)
  )
  WITH CHECK (
    (coach_id IS NOT NULL AND coach_id = auth.uid())
    OR (
      client_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = training_adjustment_recommendations.client_id AND c.user_id = auth.uid()
      )
    )
    OR public.current_user_owns_client(client_id)
  );

DROP POLICY IF EXISTS training_adjustment_recommendations_delete_coach ON public.training_adjustment_recommendations;
CREATE POLICY training_adjustment_recommendations_delete_coach ON public.training_adjustment_recommendations
  FOR DELETE USING (
    (coach_id IS NOT NULL AND coach_id = auth.uid())
    OR public.current_user_owns_client(client_id)
  );

-- -----------------------------------------------------------------------------
-- workout_logs (rows filled by trigger + reads by coach/client)
-- -----------------------------------------------------------------------------
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workout_logs_select_coach_or_client ON public.workout_logs;
CREATE POLICY workout_logs_select_coach_or_client ON public.workout_logs
  FOR SELECT USING (
    client_id IS NOT NULL
    AND (
      public.current_user_owns_client(client_id)
      OR EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = workout_logs.client_id AND c.user_id = auth.uid()
      )
    )
  );

-- Inserts/updates: SECURITY DEFINER trigger + service role; no authenticated DML policies.

-- -----------------------------------------------------------------------------
-- peak_week_day_status
-- -----------------------------------------------------------------------------
ALTER TABLE public.peak_week_day_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS peak_week_day_status_select_coach_or_client ON public.peak_week_day_status;
CREATE POLICY peak_week_day_status_select_coach_or_client ON public.peak_week_day_status
  FOR SELECT USING (
    public.current_user_owns_client(client_id)
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = peak_week_day_status.client_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS peak_week_day_status_insert_scope ON public.peak_week_day_status;
CREATE POLICY peak_week_day_status_insert_scope ON public.peak_week_day_status
  FOR INSERT WITH CHECK (
    public.current_user_owns_client(client_id)
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = peak_week_day_status.client_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS peak_week_day_status_update_scope ON public.peak_week_day_status;
CREATE POLICY peak_week_day_status_update_scope ON public.peak_week_day_status
  FOR UPDATE USING (
    public.current_user_owns_client(client_id)
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = peak_week_day_status.client_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.current_user_owns_client(client_id)
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = peak_week_day_status.client_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS peak_week_day_status_delete_coach ON public.peak_week_day_status;
CREATE POLICY peak_week_day_status_delete_coach ON public.peak_week_day_status
  FOR DELETE USING (public.current_user_owns_client(client_id));

-- -----------------------------------------------------------------------------
-- Views: security invoker (evaluate RLS as querying role)
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.habit_logs;
CREATE VIEW public.habit_logs WITH (security_invoker = true) AS
  SELECT id, habit_id, log_date, value, notes
  FROM public.client_habit_logs;
COMMENT ON VIEW public.habit_logs IS 'Legacy view: use client_habit_logs (adds client_id, completed, created_at).';

DROP VIEW IF EXISTS public.v_client_master_dashboard;
CREATE VIEW public.v_client_master_dashboard WITH (security_invoker = true) AS
SELECT
  c.id AS client_id,
  latest_phase.phase_type,
  latest_phase.block_length_weeks AS total_weeks,
  latest_phase.start_date AS phase_start_date,
  CASE
    WHEN latest_phase.start_date IS NULL THEN NULL
    ELSE LEAST(
      GREATEST(1, FLOOR((CURRENT_DATE - latest_phase.start_date) / 7)::INT + 1),
      latest_phase.block_length_weeks
    )
  END AS current_week,
  latest_compliance.training_adherence_pct AS training_adherence,
  latest_compliance.nutrition_adherence_pct AS nutrition_adherence,
  COALESCE(flags_agg.flags_count, 0)::INT AS flags_count,
  flags_agg.flags_max_severity
FROM public.clients c
LEFT JOIN LATERAL (
  SELECT phase_type, block_length_weeks, start_date
  FROM public.client_phases
  WHERE client_id = c.id
  ORDER BY start_date DESC
  LIMIT 1
) latest_phase ON true
LEFT JOIN LATERAL (
  SELECT training_adherence_pct, nutrition_adherence_pct
  FROM public.client_compliance
  WHERE client_id = c.id
  ORDER BY recorded_at DESC
  LIMIT 1
) latest_compliance ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::INT AS flags_count,
    (ARRAY_AGG(f.severity ORDER BY (
      CASE WHEN f.severity::text IN ('critical','high','medium','low') THEN
        CASE f.severity::text WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END
      ELSE LEAST(4, GREATEST(0, COALESCE((f.severity)::int, 0)))
      END
    ) DESC NULLS LAST))[1] AS flags_max_severity
  FROM public.client_flags f
  WHERE f.client_id = c.id AND f.resolved_at IS NULL
) flags_agg ON true;
