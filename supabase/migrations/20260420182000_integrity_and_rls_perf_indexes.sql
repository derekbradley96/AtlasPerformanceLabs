-- Follow-up integrity + RLS-performance hardening.
-- Keep this safe for mixed remote states by using conditional DDL.

-- ---------------------------------------------------------------------------
-- 1) Messaging participant integrity (add NOT VALID FKs where missing)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'message_threads'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'message_threads_coach_id_fkey'
    ) THEN
      ALTER TABLE public.message_threads
        ADD CONSTRAINT message_threads_coach_id_fkey
        FOREIGN KEY (coach_id)
        REFERENCES public.profiles(id)
        ON DELETE CASCADE
        NOT VALID;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'message_threads'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'clients'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'message_threads_client_id_fkey'
    ) THEN
      ALTER TABLE public.message_threads
        ADD CONSTRAINT message_threads_client_id_fkey
        FOREIGN KEY (client_id)
        REFERENCES public.clients(id)
        ON DELETE CASCADE
        NOT VALID;
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Ownership-path and common RLS predicate indexes
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'assigned_coach_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_clients_assigned_coach_id
      ON public.clients(assigned_coach_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_coach_id ON public.clients(coach_id);
CREATE INDEX IF NOT EXISTS idx_clients_trainer_id ON public.clients(trainer_id);

-- ---------------------------------------------------------------------------
-- 3) Payment/subscription FK-supporting indexes (if columns exist)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'client_payments'
      AND column_name = 'subscription_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_client_payments_subscription_id
      ON public.client_payments(subscription_id)
      WHERE subscription_id IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'client_payments'
      AND column_name = 'organisation_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_client_payments_organisation_id
      ON public.client_payments(organisation_id)
      WHERE organisation_id IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'client_subscriptions'
      AND column_name = 'organisation_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_client_subscriptions_organisation_id
      ON public.client_subscriptions(organisation_id)
      WHERE organisation_id IS NOT NULL;
  END IF;
END $$;
