-- Unified Review Center queue: public.review_queue_items (canonical table) + dismissals + view.
-- atlas_review_items exists but references atlas_coaches/atlas_clients; we use public.review_queue_items for public.clients.
-- Requires: checkins (reviewed_at), pose_checks, client_state, v_client_retention_risk. clients.billing_status added here if missing.

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'active';

-- 1) Table public.review_queue_items (queue items and/or dismissals for resolve tracking)
CREATE TABLE IF NOT EXISTS public.review_queue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('checkin', 'pose_check', 'retention_risk', 'billing_overdue', 'flag')),
  priority INTEGER NOT NULL DEFAULT 0,
  reasons TEXT[] NOT NULL DEFAULT '{}'::text[],
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_review_queue_items_coach_resolved_priority
  ON public.review_queue_items (coach_id, resolved_at, priority DESC, created_at DESC);

ALTER TABLE public.review_queue_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS review_queue_items_select_coach ON public.review_queue_items;
DROP POLICY IF EXISTS review_queue_items_update_coach ON public.review_queue_items;
DROP POLICY IF EXISTS review_queue_items_insert_coach ON public.review_queue_items;
CREATE POLICY review_queue_items_select_coach ON public.review_queue_items FOR SELECT USING (coach_id = auth.uid());
CREATE POLICY review_queue_items_update_coach ON public.review_queue_items FOR UPDATE USING (coach_id = auth.uid());
CREATE POLICY review_queue_items_insert_coach ON public.review_queue_items FOR INSERT WITH CHECK (coach_id = auth.uid());

-- 2) Dismissals for item types that have no natural "reviewed" (retention_risk, billing_overdue, flag)
CREATE TABLE IF NOT EXISTS public.review_queue_dismissals (
  coach_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('retention_risk', 'billing_overdue', 'flag')),
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (coach_id, client_id, item_type)
);
ALTER TABLE public.review_queue_dismissals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS review_queue_dismissals_select_coach ON public.review_queue_dismissals;
DROP POLICY IF EXISTS review_queue_dismissals_insert_coach ON public.review_queue_dismissals;
CREATE POLICY review_queue_dismissals_select_coach ON public.review_queue_dismissals FOR SELECT USING (coach_id = auth.uid());
CREATE POLICY review_queue_dismissals_insert_coach ON public.review_queue_dismissals FOR INSERT WITH CHECK (coach_id = auth.uid());

-- 3) View: unified queue from sources (view-based logic). Skip sources that don't exist in this DB.
-- Requires: checkins (reviewed_at), pose_checks, clients (billing_status), client_state; v_client_retention_risk optional.
DROP VIEW IF EXISTS public.v_coach_review_queue;

CREATE VIEW public.v_coach_review_queue
WITH (security_invoker = on)
AS
WITH
  current_week AS (SELECT (date_trunc('week', current_date)::date)::date AS week_start),
  coach_clients AS (
    SELECT c.id AS client_id, COALESCE(c.coach_id, c.trainer_id) AS coach_id, COALESCE(c.name, '')::text AS client_name
    FROM public.clients c
    WHERE COALESCE(c.coach_id, c.trainer_id) IS NOT NULL
  ),

  -- Check-in: new last 48h AND not reviewed -> 80
  checkin_new AS (
    SELECT
      cc.coach_id, cc.client_id, cc.client_name,
      'checkin'::text AS item_type, 80 AS priority,
      ARRAY['new_checkin_48h']::text[] AS reasons,
      ch.submitted_at AS created_at,
      jsonb_build_object('checkin_id', ch.id, 'week_start', ch.week_start) AS payload,
      ch.reviewed_at AS resolved_at
    FROM public.checkins ch
    JOIN coach_clients cc ON cc.client_id = ch.client_id
    WHERE ch.submitted_at >= (now() - interval '48 hours')
      AND ch.reviewed_at IS NULL
  ),
  -- Check-in: missed this week -> 90
  checkin_missed AS (
    SELECT
      cc.coach_id, cc.client_id, cc.client_name,
      'checkin'::text AS item_type, 90 AS priority,
      ARRAY['missed_checkin']::text[] AS reasons,
      (SELECT week_start FROM current_week)::timestamptz AS created_at,
      jsonb_build_object('week_start', (SELECT week_start FROM current_week)) AS payload,
      NULL::timestamptz AS resolved_at
    FROM coach_clients cc
    WHERE NOT EXISTS (
      SELECT 1 FROM public.checkins ch
      WHERE ch.client_id = cc.client_id AND ch.week_start = (SELECT week_start FROM current_week)
    )
  ),

  -- Pose: new last 48h AND not reviewed -> 75
  pose_new AS (
    SELECT
      cc.coach_id, cc.client_id, cc.client_name,
      'pose_check'::text AS item_type, 75 AS priority,
      ARRAY['new_pose_check_48h']::text[] AS reasons,
      pc.submitted_at AS created_at,
      jsonb_build_object('pose_check_id', pc.id, 'week_start', pc.week_start) AS payload,
      pc.reviewed_at AS resolved_at
    FROM public.pose_checks pc
    JOIN coach_clients cc ON cc.client_id = pc.client_id
    WHERE pc.submitted_at >= (now() - interval '48 hours')
      AND pc.reviewed_at IS NULL
  ),
  -- Pose: due this week (no pose check for current week) -> 85
  pose_due AS (
    SELECT
      cc.coach_id, cc.client_id, cc.client_name,
      'pose_check'::text AS item_type, 85 AS priority,
      ARRAY['pose_check_due']::text[] AS reasons,
      (SELECT week_start FROM current_week)::timestamptz AS created_at,
      jsonb_build_object('week_start', (SELECT week_start FROM current_week)) AS payload,
      NULL::timestamptz AS resolved_at
    FROM coach_clients cc
    WHERE NOT EXISTS (
      SELECT 1 FROM public.pose_checks pc
      WHERE pc.client_id = cc.client_id AND pc.week_start = (SELECT week_start FROM current_week)
    )
  ),

  -- Retention: high risk -> 70 (requires v_client_retention_risk)
  retention_high AS (
    SELECT
      r.coach_id, r.client_id, r.client_name,
      'retention_risk'::text AS item_type, 70 AS priority,
      COALESCE(r.reasons, '{}'::text[]) AS reasons,
      r.last_checkin_at AS created_at,
      jsonb_build_object('risk_score', r.risk_score, 'risk_band', r.risk_band) AS payload,
      d.resolved_at AS resolved_at
    FROM public.v_client_retention_risk r
    LEFT JOIN public.review_queue_dismissals d ON d.coach_id = r.coach_id AND d.client_id = r.client_id AND d.item_type = 'retention_risk'
    WHERE r.risk_band = 'high'
  ),

  -- Billing overdue -> 65
  billing_overdue AS (
    SELECT
      cc.coach_id, cc.client_id, cc.client_name,
      'billing_overdue'::text AS item_type, 65 AS priority,
      ARRAY['payment_overdue']::text[] AS reasons,
      now() AS created_at,
      jsonb_build_object('next_due_date', c.next_due_date, 'monthly_fee', c.monthly_fee) AS payload,
      d.resolved_at AS resolved_at
    FROM public.clients c
    JOIN coach_clients cc ON cc.client_id = c.id
    LEFT JOIN public.review_queue_dismissals d ON d.coach_id = cc.coach_id AND d.client_id = cc.client_id AND d.item_type = 'billing_overdue'
    WHERE c.billing_status = 'overdue'
  ),

  -- Active flags -> 60 (requires client_state)
  flag_active AS (
    SELECT
      cs.coach_id, cs.client_id, cc.client_name,
      'flag'::text AS item_type, 60 AS priority,
      ARRAY['active_flags']::text[] AS reasons,
      cs.updated_at AS created_at,
      jsonb_build_object('active_flags_count', cs.active_flags_count) AS payload,
      d.resolved_at AS resolved_at
    FROM public.client_state cs
    JOIN coach_clients cc ON cc.client_id = cs.client_id AND cc.coach_id = cs.coach_id
    LEFT JOIN public.review_queue_dismissals d ON d.coach_id = cs.coach_id AND d.client_id = cs.client_id AND d.item_type = 'flag'
    WHERE cs.active_flags_count > 0
  )

SELECT coach_id, client_id, client_name, item_type, priority, reasons, created_at, payload, resolved_at FROM checkin_new
UNION ALL SELECT coach_id, client_id, client_name, item_type, priority, reasons, created_at, payload, resolved_at FROM checkin_missed
UNION ALL SELECT coach_id, client_id, client_name, item_type, priority, reasons, created_at, payload, resolved_at FROM pose_new
UNION ALL SELECT coach_id, client_id, client_name, item_type, priority, reasons, created_at, payload, resolved_at FROM pose_due
UNION ALL SELECT coach_id, client_id, client_name, item_type, priority, reasons, created_at, payload, resolved_at FROM retention_high
UNION ALL SELECT coach_id, client_id, client_name, item_type, priority, reasons, created_at, payload, resolved_at FROM billing_overdue
UNION ALL SELECT coach_id, client_id, client_name, item_type, priority, reasons, created_at, payload, resolved_at FROM flag_active;

COMMENT ON VIEW public.v_coach_review_queue IS 'Unified review queue: checkin, pose_check, retention_risk, billing_overdue, flag. Query: WHERE coach_id = auth.uid() ORDER BY priority DESC, created_at DESC.';
