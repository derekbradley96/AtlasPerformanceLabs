-- Structured peak week protocol: one protocol per client/contest_prep, with daily rows (carbs, water, sodium, cardio, notes).
-- Day rows live in peak_week_protocol_days to avoid name clash with existing peak_week_days (plan_id).

CREATE TABLE IF NOT EXISTS public.peak_week_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contest_prep_id UUID NOT NULL REFERENCES public.contest_preps(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_peak_week_protocols_client
  ON public.peak_week_protocols(client_id);
CREATE INDEX IF NOT EXISTS idx_peak_week_protocols_contest_prep
  ON public.peak_week_protocols(contest_prep_id);

COMMENT ON TABLE public.peak_week_protocols IS 'Peak week protocol per client and contest prep.';

CREATE TABLE IF NOT EXISTS public.peak_week_protocol_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id UUID NOT NULL REFERENCES public.peak_week_protocols(id) ON DELETE CASCADE,
  day_date DATE,
  day_label TEXT,
  carbs_g INTEGER,
  water_l NUMERIC,
  sodium_mg INTEGER,
  cardio_minutes INTEGER,
  training_notes TEXT,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_peak_week_protocol_days_protocol
  ON public.peak_week_protocol_days(protocol_id);

COMMENT ON TABLE public.peak_week_protocol_days IS 'Daily protocol rows: carbs, water, sodium, cardio, notes. Order by sort_order.';

ALTER TABLE public.peak_week_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peak_week_protocol_days ENABLE ROW LEVEL SECURITY;

-- RLS: coach and client access via client_id (protocols) and protocol_id (days)
DROP POLICY IF EXISTS peak_week_protocols_select_coach ON public.peak_week_protocols;
DROP POLICY IF EXISTS peak_week_protocols_select_client ON public.peak_week_protocols;
DROP POLICY IF EXISTS peak_week_protocols_insert_coach ON public.peak_week_protocols;
DROP POLICY IF EXISTS peak_week_protocols_insert_client ON public.peak_week_protocols;
DROP POLICY IF EXISTS peak_week_protocols_update_coach ON public.peak_week_protocols;
DROP POLICY IF EXISTS peak_week_protocols_update_client ON public.peak_week_protocols;
DROP POLICY IF EXISTS peak_week_protocols_delete_coach ON public.peak_week_protocols;
DROP POLICY IF EXISTS peak_week_protocols_delete_client ON public.peak_week_protocols;

CREATE POLICY peak_week_protocols_select_coach ON public.peak_week_protocols
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_week_protocols.client_id AND c.coach_id = auth.uid())
  );
CREATE POLICY peak_week_protocols_select_client ON public.peak_week_protocols
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_week_protocols.client_id AND c.user_id = auth.uid())
  );
CREATE POLICY peak_week_protocols_insert_coach ON public.peak_week_protocols
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_week_protocols.client_id AND c.coach_id = auth.uid())
  );
CREATE POLICY peak_week_protocols_insert_client ON public.peak_week_protocols
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_week_protocols.client_id AND c.user_id = auth.uid())
  );
CREATE POLICY peak_week_protocols_update_coach ON public.peak_week_protocols
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_week_protocols.client_id AND c.coach_id = auth.uid())
  );
CREATE POLICY peak_week_protocols_update_client ON public.peak_week_protocols
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_week_protocols.client_id AND c.user_id = auth.uid())
  );
CREATE POLICY peak_week_protocols_delete_coach ON public.peak_week_protocols
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_week_protocols.client_id AND c.coach_id = auth.uid())
  );
CREATE POLICY peak_week_protocols_delete_client ON public.peak_week_protocols
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.clients c WHERE c.id = peak_week_protocols.client_id AND c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS peak_week_protocol_days_select_coach ON public.peak_week_protocol_days;
DROP POLICY IF EXISTS peak_week_protocol_days_select_client ON public.peak_week_protocol_days;
DROP POLICY IF EXISTS peak_week_protocol_days_insert_coach ON public.peak_week_protocol_days;
DROP POLICY IF EXISTS peak_week_protocol_days_insert_client ON public.peak_week_protocol_days;
DROP POLICY IF EXISTS peak_week_protocol_days_update_coach ON public.peak_week_protocol_days;
DROP POLICY IF EXISTS peak_week_protocol_days_update_client ON public.peak_week_protocol_days;
DROP POLICY IF EXISTS peak_week_protocol_days_delete_coach ON public.peak_week_protocol_days;
DROP POLICY IF EXISTS peak_week_protocol_days_delete_client ON public.peak_week_protocol_days;

CREATE POLICY peak_week_protocol_days_select_coach ON public.peak_week_protocol_days
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.peak_week_protocols p
      JOIN public.clients c ON c.id = p.client_id AND c.coach_id = auth.uid()
      WHERE p.id = peak_week_protocol_days.protocol_id
    )
  );
CREATE POLICY peak_week_protocol_days_select_client ON public.peak_week_protocol_days
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.peak_week_protocols p
      JOIN public.clients c ON c.id = p.client_id AND c.user_id = auth.uid()
      WHERE p.id = peak_week_protocol_days.protocol_id
    )
  );
CREATE POLICY peak_week_protocol_days_insert_coach ON public.peak_week_protocol_days
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.peak_week_protocols p
      JOIN public.clients c ON c.id = p.client_id AND c.coach_id = auth.uid()
      WHERE p.id = peak_week_protocol_days.protocol_id
    )
  );
CREATE POLICY peak_week_protocol_days_insert_client ON public.peak_week_protocol_days
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.peak_week_protocols p
      JOIN public.clients c ON c.id = p.client_id AND c.user_id = auth.uid()
      WHERE p.id = peak_week_protocol_days.protocol_id
    )
  );
CREATE POLICY peak_week_protocol_days_update_coach ON public.peak_week_protocol_days
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.peak_week_protocols p
      JOIN public.clients c ON c.id = p.client_id AND c.coach_id = auth.uid()
      WHERE p.id = peak_week_protocol_days.protocol_id
    )
  );
CREATE POLICY peak_week_protocol_days_update_client ON public.peak_week_protocol_days
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.peak_week_protocols p
      JOIN public.clients c ON c.id = p.client_id AND c.user_id = auth.uid()
      WHERE p.id = peak_week_protocol_days.protocol_id
    )
  );
CREATE POLICY peak_week_protocol_days_delete_coach ON public.peak_week_protocol_days
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.peak_week_protocols p
      JOIN public.clients c ON c.id = p.client_id AND c.coach_id = auth.uid()
      WHERE p.id = peak_week_protocol_days.protocol_id
    )
  );
CREATE POLICY peak_week_protocol_days_delete_client ON public.peak_week_protocol_days
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.peak_week_protocols p
      JOIN public.clients c ON c.id = p.client_id AND c.user_id = auth.uid()
      WHERE p.id = peak_week_protocol_days.protocol_id
    )
  );
