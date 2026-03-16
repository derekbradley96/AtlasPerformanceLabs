-- Coaching intelligence layer: v_client_coaching_intelligence and v_coach_attention_queue.
-- Uses: clients, client_state, checkins, v_client_latest_checkin, client_compliance, client_engagement_events.
-- Missing tables/columns degrade to null.

-- 1) Base CTEs used by both views (safe when tables missing)
DROP VIEW IF EXISTS public.v_coach_attention_queue;
DROP VIEW IF EXISTS public.v_client_coaching_intelligence;

CREATE VIEW public.v_client_coaching_intelligence
WITH (security_invoker = on)
AS
WITH
  current_week_monday AS (
    SELECT (date_trunc('week', current_date)::date) AS week_start
  ),
  -- Last check-in per client (client_state or v_client_latest_checkin)
  latest_checkin AS (
    SELECT
      v.client_id,
      v.week_start,
      v.submitted_at
    FROM public.v_client_latest_checkin v
  ),
  -- Days since last check-in (null if never)
  checkin_recency AS (
    SELECT
      lc.client_id,
      lc.submitted_at AS last_checkin_at,
      (current_date - (lc.submitted_at::date))::integer AS days_since_last_checkin
    FROM latest_checkin lc
    WHERE lc.submitted_at IS NOT NULL
  ),
  -- Engagement: event count last 14 days -> 0–100 (cap 20 events = 100)
  engagement_raw AS (
    SELECT
      e.client_id,
      count(*)::integer AS event_count_14d
    FROM public.client_engagement_events e
    WHERE e.created_at >= (now() - interval '14 days')
    GROUP BY e.client_id
  ),
  engagement_score_cte AS (
    SELECT
      client_id,
      least(100, (event_count_14d * 100 / 20))::numeric AS engagement_score
    FROM engagement_raw
  ),
  -- Latest compliance: client_state or latest client_compliance row
  latest_compliance AS (
    SELECT
      cc.client_id,
      (
        (COALESCE(cc.training_adherence_pct, 0) + COALESCE(cc.nutrition_adherence_pct, 0))
        / NULLIF(
            (CASE WHEN cc.training_adherence_pct IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN cc.nutrition_adherence_pct IS NOT NULL THEN 1 ELSE 0 END),
            0
          )
      )::numeric AS compliance_pct
    FROM (
      SELECT cc2.client_id, cc2.training_adherence_pct, cc2.nutrition_adherence_pct,
             row_number() OVER (PARTITION BY cc2.client_id ORDER BY cc2.recorded_at DESC NULLS LAST) AS rn
      FROM public.client_compliance cc2
    ) cc
    WHERE cc.rn = 1
  ),
  -- One row per client from clients; coach_id = coach_id or trainer_id
  base AS (
    SELECT
      c.id AS client_id,
      COALESCE(c.coach_id, c.trainer_id) AS coach_id,
      cr.last_checkin_at,
      cr.days_since_last_checkin,
      COALESCE(cs.engagement_score, eng.engagement_score) AS engagement_score,
      COALESCE(cs.compliance_score, cs.current_compliance, lc.compliance_pct) AS compliance_score,
      COALESCE(cs.progress_score,
        CASE
          WHEN lc.compliance_pct IS NOT NULL AND vl.reviewed_at IS NOT NULL THEN lc.compliance_pct
          WHEN vl.training_completion IS NOT NULL OR vl.nutrition_adherence IS NOT NULL THEN
            (COALESCE(vl.training_completion, 0) + COALESCE(vl.nutrition_adherence, 0))
            / NULLIF(
                (CASE WHEN vl.training_completion IS NOT NULL THEN 1 ELSE 0 END) +
                (CASE WHEN vl.nutrition_adherence IS NOT NULL THEN 1 ELSE 0 END),
                0
              )
          ELSE lc.compliance_pct
        END
      ) AS progress_score
    FROM public.clients c
    LEFT JOIN public.client_state cs ON cs.client_id = c.id
    LEFT JOIN checkin_recency cr ON cr.client_id = c.id
    LEFT JOIN engagement_score_cte eng ON eng.client_id = c.id
    LEFT JOIN latest_compliance lc ON lc.client_id = c.id
    LEFT JOIN public.v_client_latest_checkin vl ON vl.client_id = c.id
  ),
  -- Risk and attention: reasons + priority
  with_reasons AS (
    SELECT
      b.*,
      lc.week_start AS last_checkin_week_start
    FROM base b
    LEFT JOIN latest_checkin lc ON lc.client_id = b.client_id
  ),
  scored AS (
    SELECT
      wr.client_id,
      wr.coach_id,
      wr.last_checkin_at,
      wr.days_since_last_checkin,
      wr.engagement_score,
      wr.compliance_score,
      wr.progress_score,
      -- Risk level: high / medium / low
      CASE
        WHEN (wr.days_since_last_checkin > 14 OR (wr.last_checkin_week_start IS NULL OR wr.last_checkin_week_start <> (SELECT week_start FROM current_week_monday)))
             AND (wr.engagement_score IS NULL OR wr.engagement_score < 20)
          THEN 'high'
        WHEN wr.compliance_score IS NOT NULL AND wr.compliance_score < 50 THEN 'high'
        WHEN wr.days_since_last_checkin > 7 OR (wr.last_checkin_week_start IS NULL OR wr.last_checkin_week_start <> (SELECT week_start FROM current_week_monday))
          THEN 'medium'
        WHEN wr.engagement_score IS NOT NULL AND wr.engagement_score < 40 THEN 'medium'
        WHEN wr.compliance_score IS NOT NULL AND wr.compliance_score < 70 THEN 'medium'
        WHEN wr.progress_score IS NOT NULL AND wr.progress_score < 50 THEN 'medium'
        ELSE 'low'
      END AS risk_level,
      -- Attention reasons (text[])
      array_remove(ARRAY[
        CASE WHEN wr.days_since_last_checkin > 7 OR (wr.last_checkin_week_start IS NULL OR wr.last_checkin_week_start <> (SELECT week_start FROM current_week_monday))
          THEN 'checkin_overdue' END,
        CASE WHEN wr.engagement_score IS NOT NULL AND wr.engagement_score < 40 THEN 'engagement_dropping' END,
        CASE WHEN wr.compliance_score IS NOT NULL AND wr.compliance_score < 70 THEN 'compliance_low' END,
        CASE WHEN wr.progress_score IS NOT NULL AND wr.progress_score < 50 THEN 'progress_stalled' END
      ], NULL) AS attention_reason,
      -- Priority score 0–100 (higher = more urgent)
      (LEAST(100, GREATEST(0,
        (CASE WHEN wr.days_since_last_checkin > 14 OR (wr.last_checkin_week_start IS NULL OR wr.last_checkin_week_start <> (SELECT week_start FROM current_week_monday)) THEN 35 ELSE 0 END) +
        (CASE WHEN wr.engagement_score IS NOT NULL AND wr.engagement_score < 20 THEN 30 ELSE (CASE WHEN wr.engagement_score IS NOT NULL AND wr.engagement_score < 40 THEN 15 ELSE 0 END) END) +
        (CASE WHEN wr.compliance_score IS NOT NULL AND wr.compliance_score < 50 THEN 25 ELSE (CASE WHEN wr.compliance_score IS NOT NULL AND wr.compliance_score < 70 THEN 10 ELSE 0 END) END) +
        (CASE WHEN wr.progress_score IS NOT NULL AND wr.progress_score < 50 THEN 15 ELSE 0 END)
      )))::integer AS attention_priority
    FROM with_reasons wr
  )
SELECT
  client_id,
  coach_id,
  last_checkin_at,
  days_since_last_checkin,
  engagement_score,
  compliance_score,
  progress_score,
  risk_level,
  attention_reason,
  attention_priority
FROM scored;

COMMENT ON VIEW public.v_client_coaching_intelligence IS
  'One row per client: risk_level (high/medium/low), engagement/compliance/progress scores, attention_reason[] and attention_priority. Use for scoring and dashboards.';

-- 2) Coach attention queue: subset + client_name for coach dashboard
CREATE VIEW public.v_coach_attention_queue
WITH (security_invoker = on)
AS
SELECT
  i.coach_id,
  i.client_id,
  COALESCE(c.name, '')::text AS client_name,
  i.risk_level,
  i.attention_reason,
  i.attention_priority,
  i.last_checkin_at,
  i.engagement_score,
  i.compliance_score
FROM public.v_client_coaching_intelligence i
JOIN public.clients c ON c.id = i.client_id
WHERE i.coach_id IS NOT NULL;

COMMENT ON VIEW public.v_coach_attention_queue IS
  'Per-coach attention queue: clients with risk_level, attention_reason, attention_priority. Query: WHERE coach_id = auth.uid() ORDER BY attention_priority DESC.';

-- Scoring logic summary
-- ----------------------
-- days_since_last_checkin: current_date - date(last_checkin_at); null if no check-in.
-- engagement_score: 0–100 from client_engagement_events count in last 14 days (20+ events = 100). Falls back to client_state.engagement_score if present.
-- compliance_score: client_state.compliance_score or current_compliance, else latest client_compliance (avg of training_adherence_pct, nutrition_adherence_pct).
-- progress_score: client_state.progress_score, else derived from latest check-in completion/adherence or compliance_pct.
-- risk_level:
--   high: (check-in >14 days ago or missed this week) AND engagement <20; OR compliance <50.
--   medium: check-in >7 days or missed this week; OR engagement <40; OR compliance <70; OR progress <50.
--   low: otherwise.
-- attention_reason[]: checkin_overdue | engagement_dropping | compliance_low | progress_stalled (only when applicable).
-- attention_priority: 0–100 composite (missed/overdue +35, engagement low +15–30, compliance low +10–25, progress low +15). Higher = more urgent.
