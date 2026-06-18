-- Adds covering indexes for foreign key constraints flagged by Supabase
-- "unindexed_foreign_keys" advisor output.
--
-- Idempotent behavior:
-- - Locates each constraint by name.
-- - Skips creation when an equivalent leading-column index already exists.
-- - Creates a deterministic index name with hash suffix to avoid collisions.

DO $$
DECLARE
  v_constraint_name text;
  v_conrelid oid;
  v_conkey int2[];
  v_table_name text;
  v_schema_name text;
  v_col_list_sql text;
  v_has_covering_index boolean;
  v_index_name text;
BEGIN
  FOR v_constraint_name IN
    SELECT unnest(ARRAY[
      'atlas_retention_review_items_client_id_fkey',
      'atlas_review_items_client_id_fkey',
      'client_habits_coach_id_fkey',
      'client_payments_organisation_id_fkey',
      'client_payments_subscription_id_fkey',
      'client_subscriptions_organisation_id_fkey',
      'exercise_favorites_exercise_id_fkey',
      'exercise_substitutions_substitute_exercise_id_fkey',
      'exercise_template_links_exercise_id_fkey',
      'exercise_usage_exercise_id_fkey',
      'group_messages_deleted_by_fkey',
      'group_messages_reply_to_id_fkey',
      'group_messages_sender_user_id_fkey',
      'group_rooms_pinned_message_fk',
      'nutrition_adjustments_coach_id_fkey',
      'organisation_invites_invited_by_fkey',
      'organisations_owner_profile_id_fkey',
      'peak_week_days_reviewed_by_fkey',
      'peak_week_plans_prep_id_fkey',
      'peak_weeks_contest_prep_id_fkey',
      'pose_checks_prep_id_fkey',
      'program_adjustments_coach_id_fkey',
      'program_assignments_program_id_fkey',
      'program_exercises_exercise_library_id_fkey',
      'programs_trainer_id_fkey',
      'review_queue_dismissals_client_id_fkey',
      'review_queue_items_client_id_fkey',
      'workout_sessions_program_day_id_fkey',
      'atlas_clients_coach_id_fkey',
      'atlas_invoice_fees_coach_id_fkey',
      'atlas_leads_coach_id_fkey',
      'atlas_payments_client_id_fkey',
      'atlas_payments_coach_id_fkey',
      'atlas_payments_lead_id_fkey',
      'atlas_services_coach_id_fkey',
      'client_engagement_events_coach_id_fkey',
      'client_payments_client_id_fkey',
      'client_result_stories_client_id_fkey',
      'client_subscriptions_client_id_fkey',
      'client_supplements_client_id_fkey',
      'client_supplements_supplement_id_fkey',
      'clients_assigned_coach_id_fkey',
      'clients_organisation_id_fkey',
      'clients_selected_service_id_fkey',
      'closeouts_trainer_id_fkey',
      'coach_plan_subscriptions_organisation_id_fkey',
      'coach_plan_subscriptions_plan_id_fkey',
      'coach_referrals_referred_coach_id_fkey',
      'coach_sessions_client_id_fkey',
      'exercise_media_exercise_id_fkey',
      'exercise_performance_client_id_fkey',
      'group_messages_room_id_fkey',
      'group_room_members_user_id_fkey',
      'invoices_client_id_fkey',
      'invoices_trainer_id_fkey',
      'leads_trainer_id_fkey',
      'lifts_client_id_fkey',
      'marketplace_coach_media_marketplace_profile_id_fkey',
      'message_messages_reply_to_id_fkey',
      'message_threads_client_id_fkey',
      'message_threads_coach_id_fkey',
      'milestones_client_id_fkey',
      'nutrition_adjustments_client_id_fkey',
      'nutrition_plans_trainer_id_fkey',
      'organisation_invites_organisation_id_fkey',
      'organisation_members_profile_id_fkey',
      'peak_week_checkins_client_id_fkey',
      'peak_week_checkins_peak_week_id_fkey',
      'peak_week_day_status_client_id_fkey',
      'peak_week_protocol_days_protocol_id_fkey',
      'peak_week_protocols_client_id_fkey',
      'peak_week_protocols_contest_prep_id_fkey',
      'pose_conditioning_notes_pose_check_item_id_fkey',
      'posing_submissions_client_id_fkey',
      'prep_outcomes_contest_prep_id_fkey',
      'prep_peak_overrides_client_id_fkey',
      'profiles_organisation_id_fkey',
      'program_adjustments_client_id_fkey',
      'program_assignments_client_id_fkey',
      'program_blocks_owner_profile_id_fkey',
      'retention_habit_daily_client_id_fkey',
      'stage_readiness_scores_client_id_fkey',
      'stage_readiness_scores_peak_week_id_fkey',
      'supplement_logs_client_supplement_id_fkey',
      'workout_logs_client_id_fkey'
    ])
  LOOP
    SELECT
      c.conrelid,
      c.conkey,
      cls.relname,
      nsp.nspname
    INTO
      v_conrelid,
      v_conkey,
      v_table_name,
      v_schema_name
    FROM pg_constraint c
    JOIN pg_class cls ON cls.oid = c.conrelid
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    WHERE c.contype = 'f'
      AND c.conname = v_constraint_name
      AND nsp.nspname = 'public'
    LIMIT 1;

    IF v_conrelid IS NULL THEN
      RAISE NOTICE 'Skipping missing FK constraint: %', v_constraint_name;
      CONTINUE;
    END IF;

    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY k.ord)
    INTO v_col_list_sql
    FROM unnest(v_conkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a
      ON a.attrelid = v_conrelid
     AND a.attnum = k.attnum;

    SELECT EXISTS (
      SELECT 1
      FROM pg_index i
      WHERE i.indrelid = v_conrelid
        AND i.indisvalid
        AND i.indpred IS NULL
        AND i.indnkeyatts >= COALESCE(array_length(v_conkey, 1), 0)
        AND (
          SELECT bool_and(i.indkey[s] = v_conkey[s])
          FROM generate_subscripts(v_conkey, 1) AS s
        )
    )
    INTO v_has_covering_index;

    IF v_has_covering_index THEN
      CONTINUE;
    END IF;

    v_index_name := format(
      'idx_%s_%s_fk',
      left(v_table_name, 35),
      left(md5(v_constraint_name), 16)
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (%s)',
      v_index_name,
      v_schema_name,
      v_table_name,
      v_col_list_sql
    );
  END LOOP;
END $$;
