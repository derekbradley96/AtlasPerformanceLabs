-- Attention queue: rank clients by attention_score for each coach.
-- Week = Monday of current date (ISO week). Messaging = message_threads + message_messages.

CREATE OR REPLACE VIEW public.v_coach_attention_queue
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
      v.submitted_at,
      v.reviewed_at,
      v.training_completion,
      v.nutrition_adherence,
      v.cardio_completion,
      -- Compliance: average of non-null completion/adherence metrics
      CASE
        WHEN (v.training_completion IS NOT NULL OR v.nutrition_adherence IS NOT NULL OR v.cardio_completion IS NOT NULL) THEN
          (COALESCE(v.training_completion, 0) + COALESCE(v.nutrition_adherence, 0) + COALESCE(v.cardio_completion, 0))
          / NULLIF(
              (CASE WHEN v.training_completion IS NOT NULL THEN 1 ELSE 0 END) +
              (CASE WHEN v.nutrition_adherence IS NOT NULL THEN 1 ELSE 0 END) +
              (CASE WHEN v.cardio_completion IS NOT NULL THEN 1 ELSE 0 END),
              0
            )
        ELSE NULL
      END AS compliance
    FROM public.v_client_latest_checkin v
  ),
  last_message AS (
    SELECT
      mt.coach_id,
      mt.client_id,
      max(mm.created_at) AS last_msg_at
    FROM public.message_threads mt
    LEFT JOIN public.message_messages mm ON mm.thread_id = mt.id
    WHERE mt.deleted_at IS NULL
    GROUP BY mt.coach_id, mt.client_id
  ),
  has_flags AS (
    SELECT
      client_id,
      true AS has_active_flags
    FROM public.client_flags
    WHERE resolved_at IS NULL
    GROUP BY client_id
  )
SELECT
  c.trainer_id AS coach_id,
  c.id AS client_id,
  COALESCE(c.name, '')::text AS client_name,
  (
    (CASE WHEN (lc.week_start IS NULL OR lc.week_start <> (SELECT week_start FROM current_week_monday)) THEN 70 ELSE 0 END) +
    (CASE WHEN lc.submitted_at IS NOT NULL AND lc.submitted_at >= (now() - interval '48 hours') AND lc.reviewed_at IS NULL THEN 50 ELSE 0 END) +
    (CASE WHEN lc.compliance IS NOT NULL AND lc.compliance < 70 THEN 40 ELSE 0 END) +
    (CASE WHEN hf.has_active_flags THEN 30 ELSE 0 END) +
    (CASE WHEN lm.last_msg_at IS NULL OR lm.last_msg_at < (now() - interval '7 days') THEN 25 ELSE 0 END)
  )::integer AS attention_score,
  (
    array_remove(ARRAY[
      CASE WHEN (lc.week_start IS NULL OR lc.week_start <> (SELECT week_start FROM current_week_monday)) THEN 'missed_checkin_this_week' END,
      CASE WHEN lc.submitted_at IS NOT NULL AND lc.submitted_at >= (now() - interval '48 hours') AND lc.reviewed_at IS NULL THEN 'new_checkin_last_48h' END,
      CASE WHEN lc.compliance IS NOT NULL AND lc.compliance < 70 THEN 'compliance_under_70' END,
      CASE WHEN hf.has_active_flags THEN 'has_active_flags' END,
      CASE WHEN lm.last_msg_at IS NULL OR lm.last_msg_at < (now() - interval '7 days') THEN 'no_message_in_7_days' END
    ], NULL)
  ) AS reasons,
  lc.submitted_at AS last_checkin_at,
  lc.compliance,
  COALESCE(hf.has_active_flags, false) AS has_active_flags
FROM public.clients c
LEFT JOIN latest_checkin lc ON lc.client_id = c.id
LEFT JOIN has_flags hf ON hf.client_id = c.id
LEFT JOIN last_message lm ON lm.coach_id = c.trainer_id AND lm.client_id = c.id;

COMMENT ON VIEW public.v_coach_attention_queue IS 'Per-coach client queue by attention_score. Score: +70 missed check-in this week, +50 new check-in last 48h unreviewed, +40 compliance<70, +30 has active flags, +25 no message in 7 days. Query: WHERE coach_id = auth.uid() ORDER BY attention_score DESC.';

-- UI query (coach dashboard):
--   select * from v_coach_attention_queue where coach_id = auth.uid() order by attention_score desc;
-- Columns: coach_id, client_id, client_name, attention_score, reasons, last_checkin_at, compliance, has_active_flags.
-- Use reasons[] to show badges or tooltips (e.g. "Missed check-in", "New unreviewed", "Low compliance", "Active flags", "No message 7d").
