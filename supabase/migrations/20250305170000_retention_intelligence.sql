-- Retention Intelligence: engagement events table, triggers, and retention risk view.
-- Ownership: same as checkins (client = clients.user_id = auth.uid(), coach = clients.trainer_id = auth.uid()).

-- 1) Table public.client_engagement_events
CREATE TABLE IF NOT EXISTS public.client_engagement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'checkin_submitted', 'message_sent', 'program_completed',
    'photo_uploaded', 'payment_failed', 'payment_success'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_client_engagement_events_client_created
  ON public.client_engagement_events (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_engagement_events_type_created
  ON public.client_engagement_events (event_type, created_at DESC);

ALTER TABLE public.client_engagement_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_engagement_events_select_client ON public.client_engagement_events;
CREATE POLICY client_engagement_events_select_client ON public.client_engagement_events
  FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS client_engagement_events_insert_client ON public.client_engagement_events;
CREATE POLICY client_engagement_events_insert_client ON public.client_engagement_events
  FOR INSERT WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS client_engagement_events_select_coach ON public.client_engagement_events;
CREATE POLICY client_engagement_events_select_coach ON public.client_engagement_events
  FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE trainer_id = auth.uid()));

-- 2) Trigger: on checkin insert -> engagement event (SECURITY DEFINER so trigger can insert regardless of inserter)
CREATE OR REPLACE FUNCTION public.record_checkin_engagement_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.client_engagement_events (client_id, event_type, meta)
  VALUES (
    NEW.client_id,
    'checkin_submitted',
    jsonb_build_object('checkin_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS checkins_insert_engagement_event ON public.checkins;
CREATE TRIGGER checkins_insert_engagement_event
  AFTER INSERT ON public.checkins
  FOR EACH ROW
  EXECUTE FUNCTION public.record_checkin_engagement_event();

-- 3) Trigger: on message insert -> engagement event (messaging tables exist)
CREATE OR REPLACE FUNCTION public.record_message_engagement_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
BEGIN
  SELECT client_id INTO v_client_id
  FROM public.message_threads
  WHERE id = NEW.thread_id;
  IF v_client_id IS NOT NULL THEN
    INSERT INTO public.client_engagement_events (client_id, event_type, meta)
    VALUES (
      v_client_id,
      'message_sent',
      jsonb_build_object('thread_id', NEW.thread_id, 'message_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS message_messages_insert_engagement_event ON public.message_messages;
CREATE TRIGGER message_messages_insert_engagement_event
  AFTER INSERT ON public.message_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.record_message_engagement_event();

-- 4) View public.v_client_retention_risk
CREATE OR REPLACE VIEW public.v_client_retention_risk
WITH (security_invoker = on)
AS
WITH
  current_week_monday AS (
    SELECT (date_trunc('week', current_date)::date) AS week_start
  ),
  latest_checkin AS (
    SELECT
      v.client_id,
      v.week_start,
      v.submitted_at
    FROM public.v_client_latest_checkin v
  ),
  checkins_4w AS (
    SELECT
      client_id,
      count(*)::int AS cnt
    FROM public.checkins
    WHERE submitted_at >= (now() - interval '4 weeks')
    GROUP BY client_id
  ),
  messages_7d AS (
    SELECT
      mt.coach_id,
      mt.client_id,
      count(mm.id)::int AS cnt
    FROM public.message_threads mt
    JOIN public.message_messages mm ON mm.thread_id = mt.id
    WHERE mt.deleted_at IS NULL
      AND mm.created_at >= (now() - interval '7 days')
    GROUP BY mt.coach_id, mt.client_id
  ),
  compliance_scores AS (
    SELECT
      client_id,
      recorded_at,
      (COALESCE(training_adherence_pct, 0) + COALESCE(nutrition_adherence_pct, 0))
        / NULLIF((CASE WHEN training_adherence_pct IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN nutrition_adherence_pct IS NOT NULL THEN 1 ELSE 0 END), 0) AS score
    FROM public.client_compliance
  ),
  ranked_compliance AS (
    SELECT client_id, score,
           row_number() OVER (PARTITION BY client_id ORDER BY recorded_at DESC) AS rn
    FROM compliance_scores
  ),
  compliance_trend_calc AS (
    SELECT
      a.client_id,
      (a.score - b.score)::numeric AS compliance_trend
    FROM ranked_compliance a
    JOIN ranked_compliance b ON a.client_id = b.client_id AND a.rn = 1 AND b.rn = 2
  )
SELECT
  coach_id,
  client_id,
  client_name,
  risk_score,
  CASE WHEN risk_score >= 70 THEN 'high' WHEN risk_score >= 40 THEN 'medium' ELSE 'low' END::text AS risk_band,
  reasons,
  last_checkin_at,
  checkins_last_4w,
  messages_last_7d,
  compliance_trend
FROM (
  SELECT
    c.trainer_id AS coach_id,
    c.id AS client_id,
    COALESCE(c.name, '')::text AS client_name,
    LEAST(100, GREATEST(0,
      (CASE WHEN (lc.week_start IS NULL OR lc.week_start <> (SELECT week_start FROM current_week_monday)) THEN 35 ELSE 0 END) +
      (CASE WHEN COALESCE(c4.cnt, 0) <= 2 THEN 25 ELSE 0 END) +
      (CASE WHEN COALESCE(m7.cnt, 0) = 0 THEN 25 ELSE 0 END) +
      (CASE WHEN ct.compliance_trend IS NOT NULL AND ct.compliance_trend <= -10 THEN 20 ELSE 0 END)
    ))::int AS risk_score,
    array_remove(ARRAY[
      CASE WHEN (lc.week_start IS NULL OR lc.week_start <> (SELECT week_start FROM current_week_monday)) THEN 'missed_checkin_this_week' END,
      CASE WHEN COALESCE(c4.cnt, 0) <= 2 THEN 'checkins_last_4w_low' END,
      CASE WHEN COALESCE(m7.cnt, 0) = 0 THEN 'no_messages_last_7d' END,
      CASE WHEN ct.compliance_trend IS NOT NULL AND ct.compliance_trend <= -10 THEN 'compliance_declining' END
    ], NULL) AS reasons,
    lc.submitted_at AS last_checkin_at,
    COALESCE(c4.cnt, 0)::int AS checkins_last_4w,
    COALESCE(m7.cnt, 0)::int AS messages_last_7d,
    ct.compliance_trend AS compliance_trend
  FROM public.clients c
  LEFT JOIN latest_checkin lc ON lc.client_id = c.id
  LEFT JOIN checkins_4w c4 ON c4.client_id = c.id
  LEFT JOIN messages_7d m7 ON m7.coach_id = c.trainer_id AND m7.client_id = c.id
  LEFT JOIN compliance_trend_calc ct ON ct.client_id = c.id
) sub;

COMMENT ON VIEW public.v_client_retention_risk IS 'Retention risk per client: risk_score 0-100, risk_band high/medium/low. Query: WHERE coach_id = auth.uid() ORDER BY risk_score DESC.';

-- Coach dashboard: retention risk queue (highest risk first)
--   select * from v_client_retention_risk where coach_id = auth.uid() order by risk_score desc;
-- Filter by band: add "and risk_band = 'high'" or "and risk_score >= 40". Use reasons[] for badges/tooltips.
