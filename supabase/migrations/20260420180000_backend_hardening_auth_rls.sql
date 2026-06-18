-- Atlas backend hardening pass: auth/RLS targeted fixes.
-- 1) Lock onboarding docs RPC to authenticated users with relationship checks.
-- 2) Replace open referral events insert policy.
-- 3) Add WITH CHECK guards on messaging update policies.

-- ---------------------------------------------------------------------------
-- 1) Coach onboarding documents RPC hardening
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_coach_onboarding_documents'
      AND pg_get_function_identity_arguments(p.oid) = 'p_coach_id uuid'
  ) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.get_coach_onboarding_documents(UUID) FROM anon';
    EXECUTE 'REVOKE ALL ON FUNCTION public.get_coach_onboarding_documents(UUID) FROM authenticated';
  END IF;
END $$;

-- Only (re)define RPC when coach_documents exists (older remotes may not have onboarding migrations yet).
SET check_function_bodies = off;
DO $harden_onboarding_rpc$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'coach_documents'
  ) THEN
    EXECUTE $ddl$
CREATE OR REPLACE FUNCTION public.get_coach_onboarding_documents(p_coach_id UUID)
RETURNS TABLE (id UUID, type TEXT, title TEXT, content TEXT, sort_order INT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT d.id, d.type, d.title, d.content, d.sort_order
  FROM public.coach_documents d
  WHERE d.coach_id = p_coach_id
    AND (
      auth.uid() = p_coach_id
      OR EXISTS (
        SELECT 1
        FROM public.clients c
        WHERE c.user_id = auth.uid()
          AND COALESCE(c.coach_id, c.trainer_id) = p_coach_id
      )
    )
  ORDER BY d.sort_order ASC, d.type, d.created_at ASC;
$fn$;
$ddl$;
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_coach_onboarding_documents(UUID) TO authenticated';
    EXECUTE 'COMMENT ON FUNCTION public.get_coach_onboarding_documents(UUID) IS ' ||
      quote_literal('Returns onboarding docs only to authenticated coach owner or their linked client.');
  END IF;
END $harden_onboarding_rpc$;
SET check_function_bodies = on;

-- ---------------------------------------------------------------------------
-- 2) Referral events insert hardening
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS coach_referral_events_insert ON public.coach_referral_events;

CREATE POLICY coach_referral_events_insert ON public.coach_referral_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    event_type IN ('link_opened', 'profile_viewed', 'enquiry_started', 'signup_completed')
    AND EXISTS (
      SELECT 1
      FROM public.coach_referral_codes crc
      WHERE crc.coach_id = coach_referral_events.coach_id
        AND crc.code = coach_referral_events.code
        AND crc.is_active = true
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Messaging update policy hardening with WITH CHECK guards
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS message_threads_update ON public.message_threads;
CREATE POLICY message_threads_update ON public.message_threads
  FOR UPDATE
  USING (
    coach_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = client_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    coach_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = client_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS message_messages_update ON public.message_messages;
CREATE POLICY message_messages_update ON public.message_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.message_threads mt
      WHERE mt.id = thread_id
        AND mt.deleted_at IS NULL
        AND (
          mt.coach_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.clients c
            WHERE c.id = mt.client_id
              AND c.user_id = auth.uid()
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.message_threads mt
      WHERE mt.id = thread_id
        AND mt.deleted_at IS NULL
        AND (
          mt.coach_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.clients c
            WHERE c.id = mt.client_id
              AND c.user_id = auth.uid()
          )
        )
    )
  );
