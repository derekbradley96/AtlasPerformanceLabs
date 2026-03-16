-- Habit tracking: client_habits (assignments) and client_habit_logs (daily adherence).
-- Evolves existing client_habits/habit_logs if present; otherwise creates tables.
-- Categories: steps, sleep, water, nutrition, cardio, posing, supplement, custom.
-- Target types: boolean, numeric_min, numeric_exact.

-- 1) client_habits: ensure full schema (add columns if table exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_habits') THEN
    CREATE TABLE public.client_habits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
      coach_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_value NUMERIC,
      unit TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX client_habits_client_id_idx ON public.client_habits(client_id);
    ALTER TABLE public.client_habits ADD CONSTRAINT client_habits_category_check
      CHECK (category IN ('steps', 'sleep', 'water', 'nutrition', 'cardio', 'posing', 'supplement', 'custom'));
    ALTER TABLE public.client_habits ADD CONSTRAINT client_habits_target_type_check
      CHECK (target_type IN ('boolean', 'numeric_min', 'numeric_exact'));
    COMMENT ON TABLE public.client_habits IS 'Habit definitions per client: title, category, target_type/target_value, unit.';
  ELSE
    ALTER TABLE public.client_habits ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    ALTER TABLE public.client_habits ADD COLUMN IF NOT EXISTS title TEXT;
    ALTER TABLE public.client_habits ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE public.client_habits ADD COLUMN IF NOT EXISTS category TEXT;
    ALTER TABLE public.client_habits ADD COLUMN IF NOT EXISTS target_type TEXT;
    ALTER TABLE public.client_habits ADD COLUMN IF NOT EXISTS unit TEXT;
    ALTER TABLE public.client_habits ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
    UPDATE public.client_habits SET title = COALESCE(habit_name, 'Habit') WHERE title IS NULL;
    UPDATE public.client_habits SET category = COALESCE(category, 'custom') WHERE category IS NULL;
    UPDATE public.client_habits SET target_type = COALESCE(habit_type, 'numeric_min') WHERE target_type IS NULL;
    UPDATE public.client_habits SET target_type = CASE
      WHEN target_type IN ('boolean', 'numeric_min', 'numeric_exact') THEN target_type
      ELSE 'numeric_min'
    END WHERE target_type IS NOT NULL;
    UPDATE public.client_habits SET category = CASE
      WHEN category IN ('steps', 'sleep', 'water', 'nutrition', 'cardio', 'posing', 'supplement', 'custom') THEN category
      ELSE 'custom'
    END WHERE category IS NOT NULL;
    ALTER TABLE public.client_habits ALTER COLUMN title SET NOT NULL;
    ALTER TABLE public.client_habits ALTER COLUMN category SET NOT NULL;
    ALTER TABLE public.client_habits ALTER COLUMN target_type SET NOT NULL;
    ALTER TABLE public.client_habits DROP CONSTRAINT IF EXISTS client_habits_category_check;
    ALTER TABLE public.client_habits ADD CONSTRAINT client_habits_category_check
      CHECK (category IN ('steps', 'sleep', 'water', 'nutrition', 'cardio', 'posing', 'supplement', 'custom'));
    ALTER TABLE public.client_habits DROP CONSTRAINT IF EXISTS client_habits_target_type_check;
    ALTER TABLE public.client_habits ADD CONSTRAINT client_habits_target_type_check
      CHECK (target_type IN ('boolean', 'numeric_min', 'numeric_exact'));
    CREATE INDEX IF NOT EXISTS client_habits_client_id_idx ON public.client_habits(client_id);
  END IF;
END $$;

-- 2) client_habit_logs: create or migrate from habit_logs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_habit_logs') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'habit_logs') THEN
      -- Migrate: add columns to habit_logs, then rename
      ALTER TABLE public.habit_logs ADD COLUMN IF NOT EXISTS client_id UUID;
      ALTER TABLE public.habit_logs ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE public.habit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
      UPDATE public.habit_logs l SET client_id = h.client_id
        FROM public.client_habits h WHERE h.id = l.habit_id AND l.client_id IS NULL;
      UPDATE public.habit_logs SET completed = COALESCE((value IS NOT NULL AND value >= 1), false) WHERE completed IS NULL;
      DELETE FROM public.habit_logs WHERE client_id IS NULL;
      ALTER TABLE public.habit_logs ALTER COLUMN client_id SET NOT NULL;
      ALTER TABLE public.habit_logs RENAME TO client_habit_logs;
    ELSE
      CREATE TABLE public.client_habit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        habit_id UUID NOT NULL REFERENCES public.client_habits(id) ON DELETE CASCADE,
        client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
        log_date DATE NOT NULL,
        value NUMERIC,
        completed BOOLEAN NOT NULL DEFAULT false,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT client_habit_logs_habit_date_unique UNIQUE (habit_id, log_date)
      );
    END IF;
  END IF;
END $$;

-- Ensure client_habit_logs has required structure if it was created by rename (habit_logs may not have had unique)
ALTER TABLE public.client_habit_logs ADD COLUMN IF NOT EXISTS client_id UUID;
ALTER TABLE public.client_habit_logs ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.client_habit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE public.client_habit_logs l SET client_id = h.client_id
  FROM public.client_habits h WHERE h.id = l.habit_id AND l.client_id IS NULL;
DELETE FROM public.client_habit_logs WHERE client_id IS NULL;
ALTER TABLE public.client_habit_logs ALTER COLUMN client_id SET NOT NULL;
ALTER TABLE public.client_habit_logs DROP CONSTRAINT IF EXISTS client_habit_logs_habit_date_unique;
ALTER TABLE public.client_habit_logs ADD CONSTRAINT client_habit_logs_habit_date_unique UNIQUE (habit_id, log_date);

CREATE INDEX IF NOT EXISTS client_habit_logs_client_date_idx ON public.client_habit_logs(client_id, log_date DESC);
CREATE INDEX IF NOT EXISTS client_habit_logs_habit_id_idx ON public.client_habit_logs(habit_id);

COMMENT ON TABLE public.client_habit_logs IS 'Daily habit log: one row per habit per day (value, completed, notes).';

-- 3) RLS
ALTER TABLE public.client_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_habit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_habits_select_coach ON public.client_habits;
DROP POLICY IF EXISTS client_habits_insert_coach ON public.client_habits;
DROP POLICY IF EXISTS client_habits_update_coach ON public.client_habits;
DROP POLICY IF EXISTS client_habits_delete_coach ON public.client_habits;
DROP POLICY IF EXISTS client_habits_select_client ON public.client_habits;
DROP POLICY IF EXISTS client_habits_insert_client ON public.client_habits;
DROP POLICY IF EXISTS client_habits_update_client ON public.client_habits;
DROP POLICY IF EXISTS client_habits_delete_client ON public.client_habits;

CREATE POLICY client_habits_select_coach ON public.client_habits FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_habits.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid()))
);
CREATE POLICY client_habits_insert_coach ON public.client_habits FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_habits.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid()))
);
CREATE POLICY client_habits_update_coach ON public.client_habits FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_habits.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid()))
);
CREATE POLICY client_habits_delete_coach ON public.client_habits FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_habits.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid()))
);
CREATE POLICY client_habits_select_client ON public.client_habits FOR SELECT USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);
CREATE POLICY client_habits_insert_client ON public.client_habits FOR INSERT WITH CHECK (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);
CREATE POLICY client_habits_update_client ON public.client_habits FOR UPDATE USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);
CREATE POLICY client_habits_delete_client ON public.client_habits FOR DELETE USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);

-- client_habit_logs policies (drop old habit_logs-named policies from client_habit_logs after rename, then create)
DROP POLICY IF EXISTS habit_logs_select_coach ON public.client_habit_logs;
DROP POLICY IF EXISTS habit_logs_insert_coach ON public.client_habit_logs;
DROP POLICY IF EXISTS habit_logs_update_coach ON public.client_habit_logs;
DROP POLICY IF EXISTS habit_logs_delete_coach ON public.client_habit_logs;
DROP POLICY IF EXISTS habit_logs_select_client ON public.client_habit_logs;
DROP POLICY IF EXISTS habit_logs_insert_client ON public.client_habit_logs;
DROP POLICY IF EXISTS habit_logs_update_client ON public.client_habit_logs;
DROP POLICY IF EXISTS habit_logs_delete_client ON public.client_habit_logs;

DROP POLICY IF EXISTS client_habit_logs_select_coach ON public.client_habit_logs;
DROP POLICY IF EXISTS client_habit_logs_insert_coach ON public.client_habit_logs;
DROP POLICY IF EXISTS client_habit_logs_update_coach ON public.client_habit_logs;
DROP POLICY IF EXISTS client_habit_logs_delete_coach ON public.client_habit_logs;
DROP POLICY IF EXISTS client_habit_logs_select_client ON public.client_habit_logs;
DROP POLICY IF EXISTS client_habit_logs_insert_client ON public.client_habit_logs;
DROP POLICY IF EXISTS client_habit_logs_update_client ON public.client_habit_logs;
DROP POLICY IF EXISTS client_habit_logs_delete_client ON public.client_habit_logs;

CREATE POLICY client_habit_logs_select_coach ON public.client_habit_logs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.client_habits h
    JOIN public.clients c ON c.id = h.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid())
    WHERE h.id = client_habit_logs.habit_id
  )
);
CREATE POLICY client_habit_logs_insert_coach ON public.client_habit_logs FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.client_habits h
    JOIN public.clients c ON c.id = h.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid())
    WHERE h.id = client_habit_logs.habit_id
  )
);
CREATE POLICY client_habit_logs_update_coach ON public.client_habit_logs FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.client_habits h
    JOIN public.clients c ON c.id = h.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid())
    WHERE h.id = client_habit_logs.habit_id
  )
);
CREATE POLICY client_habit_logs_delete_coach ON public.client_habit_logs FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.client_habits h
    JOIN public.clients c ON c.id = h.client_id AND (c.coach_id = auth.uid() OR c.trainer_id = auth.uid())
    WHERE h.id = client_habit_logs.habit_id
  )
);
CREATE POLICY client_habit_logs_select_client ON public.client_habit_logs FOR SELECT USING (
  habit_id IN (
    SELECT id FROM public.client_habits
    WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  )
);
CREATE POLICY client_habit_logs_insert_client ON public.client_habit_logs FOR INSERT WITH CHECK (
  habit_id IN (
    SELECT id FROM public.client_habits
    WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  )
);
CREATE POLICY client_habit_logs_update_client ON public.client_habit_logs FOR UPDATE USING (
  habit_id IN (
    SELECT id FROM public.client_habits
    WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  )
);
CREATE POLICY client_habit_logs_delete_client ON public.client_habit_logs FOR DELETE USING (
  habit_id IN (
    SELECT id FROM public.client_habits
    WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  )
);

-- Backfill view for legacy app: habit_logs -> client_habit_logs (read-only view so existing reads keep working until app is updated)
DROP VIEW IF EXISTS public.habit_logs;
CREATE VIEW public.habit_logs AS
  SELECT id, habit_id, log_date, value, notes
  FROM public.client_habit_logs;
COMMENT ON VIEW public.habit_logs IS 'Legacy view: use client_habit_logs (adds client_id, completed, created_at).';

-- ---------------------------------------------------------------------------
-- Schema summary
-- ---------------------------------------------------------------------------
-- client_habits:
--   id, client_id (FK clients), coach_id (FK profiles), title, description,
--   category (steps|sleep|water|nutrition|cardio|posing|supplement|custom),
--   target_type (boolean|numeric_min|numeric_exact), target_value, unit,
--   is_active, created_at.
--   Index: client_habits_client_id_idx(client_id).
--
-- client_habit_logs:
--   id, habit_id (FK client_habits), client_id (FK clients), log_date,
--   value, completed, notes, created_at.
--   Unique: (habit_id, log_date). One log per habit per day.
--   Indexes: client_habit_logs_client_date_idx(client_id, log_date DESC),
--            client_habit_logs_habit_id_idx(habit_id).
--
-- RLS: coach (coach_id or trainer_id on clients) and client (user_id on clients)
-- have SELECT/INSERT/UPDATE/DELETE on both tables.
