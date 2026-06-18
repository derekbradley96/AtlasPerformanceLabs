-- Security Advisor (splinter):
-- 0011_function_search_path_mutable — set immutable search_path on flagged functions
-- 0024_permissive_rls_policy — replace INSERT ... WITH CHECK (true) where practical
--
-- Note: auth_leaked_password_protection is toggled in Supabase Dashboard → Authentication
-- → Password (HaveIBeenPwned); it is not configurable via SQL migration.

-- -----------------------------------------------------------------------------
-- Pin search_path for all overloads of each function name (production-safe).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS fq
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname = ANY (ARRAY[
        'generate_referral_code',
        'set_updated_at',
        'set_profile_referral_code',
        'set_coach_marketplace_profiles_updated_at',
        'set_marketplace_coach_profiles_updated_at',
        'set_client_prep_precision_updated_at',
        'set_client_prep_precision_daily_updated_at',
        'set_prep_peak_overrides_updated_at',
        'set_personal_prep_precision_updated_at',
        'set_personal_prep_precision_daily_updated_at',
        'phase_week_number',
        'sync_clients_phase_from_client_phases',
        'clients_coach_id',
        'generate_coach_code',
        'set_peak_week_days_updated_at',
        'set_peak_week_day_status_updated_at',
        'set_nutrition_daily_adherence_updated_at',
        'atlas_group_messages_enforce_coach_led',
        '_atlas_normalize_muscle_token',
        '_atlas_normalize_movement_token',
        '_atlas_normalize_equipment_token'
      ])
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.fq);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- coach_referral_events: anonymous tracking inserts — require non-empty code/type
-- (FK already constrains coach_id to profiles).
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS coach_referral_events_insert ON public.coach_referral_events;
CREATE POLICY coach_referral_events_insert ON public.coach_referral_events
  FOR INSERT WITH CHECK (
    length(trim(code)) > 0
    AND length(trim(event_type)) > 0
    AND event_type IN (
      'link_opened',
      'profile_viewed',
      'enquiry_started',
      'signup_completed'
    )
  );

-- -----------------------------------------------------------------------------
-- waitlist: public landing inserts — basic email shape (still allows anon).
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS waitlist_insert_any ON public.waitlist;
CREATE POLICY waitlist_insert_any ON public.waitlist
  FOR INSERT WITH CHECK (
    email IS NOT NULL
    AND length(trim(email)) >= 5
    AND length(trim(email)) <= 320
    AND trim(email) LIKE '%@%'
    AND trim(email) NOT LIKE '@%'
    AND trim(email) NOT LIKE '%@'
  );
