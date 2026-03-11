-- Habit tracking for transformation clients: client_habits (definitions) and habit_logs (daily entries).
-- Ownership: coach via clients.coach_id; client via clients.user_id.

CREATE TABLE IF NOT EXISTS public.client_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  habit_name TEXT NOT NULL,
  habit_type TEXT,
  target_value NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_habits_client
  ON public.client_habits(client_id);

COMMENT ON TABLE public.client_habits IS 'Habit definitions per client (name, type, target).';

CREATE TABLE IF NOT EXISTS public.habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES public.client_habits(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  value NUMERIC,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_habit_logs_habit
  ON public.habit_logs(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_date
  ON public.habit_logs(log_date DESC);

COMMENT ON TABLE public.habit_logs IS 'Daily habit log entries (value, notes per date).';

ALTER TABLE public.client_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;

-- client_habits: coach full access for their clients; client full access for own
DROP POLICY IF EXISTS client_habits_select_coach ON public.client_habits;
DROP POLICY IF EXISTS client_habits_insert_coach ON public.client_habits;
DROP POLICY IF EXISTS client_habits_update_coach ON public.client_habits;
DROP POLICY IF EXISTS client_habits_delete_coach ON public.client_habits;
DROP POLICY IF EXISTS client_habits_select_client ON public.client_habits;
DROP POLICY IF EXISTS client_habits_insert_client ON public.client_habits;
DROP POLICY IF EXISTS client_habits_update_client ON public.client_habits;
DROP POLICY IF EXISTS client_habits_delete_client ON public.client_habits;

CREATE POLICY client_habits_select_coach ON public.client_habits FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_habits.client_id AND c.coach_id = auth.uid())
);
CREATE POLICY client_habits_insert_coach ON public.client_habits FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_habits.client_id AND c.coach_id = auth.uid())
);
CREATE POLICY client_habits_update_coach ON public.client_habits FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_habits.client_id AND c.coach_id = auth.uid())
);
CREATE POLICY client_habits_delete_coach ON public.client_habits FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_habits.client_id AND c.coach_id = auth.uid())
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

-- habit_logs: access via habit_id -> client_habits.client_id
DROP POLICY IF EXISTS habit_logs_select_coach ON public.habit_logs;
DROP POLICY IF EXISTS habit_logs_insert_coach ON public.habit_logs;
DROP POLICY IF EXISTS habit_logs_update_coach ON public.habit_logs;
DROP POLICY IF EXISTS habit_logs_delete_coach ON public.habit_logs;
DROP POLICY IF EXISTS habit_logs_select_client ON public.habit_logs;
DROP POLICY IF EXISTS habit_logs_insert_client ON public.habit_logs;
DROP POLICY IF EXISTS habit_logs_update_client ON public.habit_logs;
DROP POLICY IF EXISTS habit_logs_delete_client ON public.habit_logs;

CREATE POLICY habit_logs_select_coach ON public.habit_logs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.client_habits h
    JOIN public.clients c ON c.id = h.client_id AND c.coach_id = auth.uid()
    WHERE h.id = habit_logs.habit_id
  )
);
CREATE POLICY habit_logs_insert_coach ON public.habit_logs FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.client_habits h
    JOIN public.clients c ON c.id = h.client_id AND c.coach_id = auth.uid()
    WHERE h.id = habit_logs.habit_id
  )
);
CREATE POLICY habit_logs_update_coach ON public.habit_logs FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.client_habits h
    JOIN public.clients c ON c.id = h.client_id AND c.coach_id = auth.uid()
    WHERE h.id = habit_logs.habit_id
  )
);
CREATE POLICY habit_logs_delete_coach ON public.habit_logs FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.client_habits h
    JOIN public.clients c ON c.id = h.client_id AND c.coach_id = auth.uid()
    WHERE h.id = habit_logs.habit_id
  )
);

CREATE POLICY habit_logs_select_client ON public.habit_logs FOR SELECT USING (
  habit_id IN (
    SELECT id FROM public.client_habits
    WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  )
);
CREATE POLICY habit_logs_insert_client ON public.habit_logs FOR INSERT WITH CHECK (
  habit_id IN (
    SELECT id FROM public.client_habits
    WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  )
);
CREATE POLICY habit_logs_update_client ON public.habit_logs FOR UPDATE USING (
  habit_id IN (
    SELECT id FROM public.client_habits
    WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  )
);
CREATE POLICY habit_logs_delete_client ON public.habit_logs FOR DELETE USING (
  habit_id IN (
    SELECT id FROM public.client_habits
    WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  )
);
