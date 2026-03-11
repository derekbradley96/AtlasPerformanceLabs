-- RLS and views: use clients.coach_id consistently (see docs/DB_OWNERSHIP_RULES.md).
-- Clients table: COALESCE(coach_id, trainer_id) for compatibility before/after backfill.
-- All other coach checks: client_id IN (SELECT id FROM clients WHERE coach_id = auth.uid()).

-- 1) public.clients
DROP POLICY IF EXISTS clients_select_own ON public.clients;
CREATE POLICY clients_select_own ON public.clients
  FOR SELECT USING (COALESCE(coach_id, trainer_id) = auth.uid());

DROP POLICY IF EXISTS clients_insert_own ON public.clients;
CREATE POLICY clients_insert_own ON public.clients
  FOR INSERT WITH CHECK (COALESCE(coach_id, trainer_id) = auth.uid());

DROP POLICY IF EXISTS clients_update_own ON public.clients;
CREATE POLICY clients_update_own ON public.clients
  FOR UPDATE USING (COALESCE(coach_id, trainer_id) = auth.uid());

DROP POLICY IF EXISTS clients_delete_own ON public.clients;
CREATE POLICY clients_delete_own ON public.clients
  FOR DELETE USING (COALESCE(coach_id, trainer_id) = auth.uid());

-- 2) public.checkins (coach side)
DROP POLICY IF EXISTS checkins_select_coach ON public.checkins;
CREATE POLICY checkins_select_coach ON public.checkins
  FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid()));

DROP POLICY IF EXISTS checkins_insert_coach ON public.checkins;
CREATE POLICY checkins_insert_coach ON public.checkins
  FOR INSERT WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid()));

DROP POLICY IF EXISTS checkins_update_coach ON public.checkins;
CREATE POLICY checkins_update_coach ON public.checkins
  FOR UPDATE USING (client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid()));

-- 3) storage checkin_photos (coach side)
DROP POLICY IF EXISTS checkin_photos_select_coach ON storage.objects;
CREATE POLICY checkin_photos_select_coach ON storage.objects
  FOR SELECT USING (
    bucket_id = 'checkin_photos'
    AND (storage.foldername(name))[1]::uuid IN (SELECT id FROM public.clients WHERE coach_id = auth.uid())
  );

DROP POLICY IF EXISTS checkin_photos_insert_coach ON storage.objects;
CREATE POLICY checkin_photos_insert_coach ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'checkin_photos'
    AND (storage.foldername(name))[1]::uuid IN (SELECT id FROM public.clients WHERE coach_id = auth.uid())
  );

-- 4) client_phases
DROP POLICY IF EXISTS client_phases_select ON client_phases;
CREATE POLICY client_phases_select ON client_phases FOR SELECT USING (
  coach_id = auth.uid() OR client_id IN (SELECT id FROM clients WHERE coach_id = auth.uid())
);

-- 5) client_compliance
DROP POLICY IF EXISTS client_compliance_select ON client_compliance;
CREATE POLICY client_compliance_select ON client_compliance FOR SELECT USING (
  client_id IN (SELECT id FROM clients WHERE coach_id = auth.uid())
);
DROP POLICY IF EXISTS client_compliance_insert ON client_compliance;
CREATE POLICY client_compliance_insert ON client_compliance FOR INSERT WITH CHECK (
  client_id IN (SELECT id FROM clients WHERE coach_id = auth.uid())
);

-- 6) client_flags
DROP POLICY IF EXISTS client_flags_select ON client_flags;
CREATE POLICY client_flags_select ON client_flags FOR SELECT USING (
  client_id IN (SELECT id FROM clients WHERE coach_id = auth.uid())
);
DROP POLICY IF EXISTS client_flags_insert ON client_flags;
CREATE POLICY client_flags_insert ON client_flags FOR INSERT WITH CHECK (
  client_id IN (SELECT id FROM clients WHERE coach_id = auth.uid())
);

-- 7) program_blocks
DROP POLICY IF EXISTS program_blocks_select ON program_blocks;
CREATE POLICY program_blocks_select ON program_blocks FOR SELECT USING (
  client_id IN (SELECT id FROM clients WHERE coach_id = auth.uid())
);
DROP POLICY IF EXISTS program_blocks_insert ON program_blocks;
CREATE POLICY program_blocks_insert ON program_blocks FOR INSERT WITH CHECK (
  client_id IN (SELECT id FROM clients WHERE coach_id = auth.uid())
);

-- 8) program_weeks
DROP POLICY IF EXISTS program_weeks_select ON program_weeks;
CREATE POLICY program_weeks_select ON program_weeks FOR SELECT USING (
  block_id IN (SELECT id FROM program_blocks WHERE client_id IN (SELECT id FROM clients WHERE coach_id = auth.uid()))
);
DROP POLICY IF EXISTS program_weeks_insert ON program_weeks;
CREATE POLICY program_weeks_insert ON program_weeks FOR INSERT WITH CHECK (
  block_id IN (SELECT id FROM program_blocks WHERE client_id IN (SELECT id FROM clients WHERE coach_id = auth.uid()))
);

-- 9) program_days
DROP POLICY IF EXISTS program_days_select ON program_days;
CREATE POLICY program_days_select ON program_days FOR SELECT USING (
  week_id IN (
    SELECT pw.id FROM program_weeks pw
    JOIN program_blocks pb ON pb.id = pw.block_id
    WHERE pb.client_id IN (SELECT id FROM clients WHERE coach_id = auth.uid())
  )
);
DROP POLICY IF EXISTS program_days_insert ON program_days;
CREATE POLICY program_days_insert ON program_days FOR INSERT WITH CHECK (
  week_id IN (
    SELECT pw.id FROM program_weeks pw
    JOIN program_blocks pb ON pb.id = pw.block_id
    WHERE pb.client_id IN (SELECT id FROM clients WHERE coach_id = auth.uid())
  )
);

-- 10) program_exercises
DROP POLICY IF EXISTS program_exercises_select ON program_exercises;
CREATE POLICY program_exercises_select ON program_exercises FOR SELECT USING (
  day_id IN (
    SELECT pd.id FROM program_days pd
    JOIN program_weeks pw ON pw.id = pd.week_id
    JOIN program_blocks pb ON pb.id = pw.block_id
    WHERE pb.client_id IN (SELECT id FROM clients WHERE coach_id = auth.uid())
  )
);
DROP POLICY IF EXISTS program_exercises_insert ON program_exercises;
CREATE POLICY program_exercises_insert ON program_exercises FOR INSERT WITH CHECK (
  day_id IN (
    SELECT pd.id FROM program_days pd
    JOIN program_weeks pw ON pw.id = pd.week_id
    JOIN program_blocks pb ON pb.id = pw.block_id
    WHERE pb.client_id IN (SELECT id FROM clients WHERE coach_id = auth.uid())
  )
);
DROP POLICY IF EXISTS program_exercises_update ON program_exercises;
CREATE POLICY program_exercises_update ON program_exercises FOR UPDATE USING (
  day_id IN (
    SELECT pd.id FROM program_days pd
    JOIN program_weeks pw ON pw.id = pd.week_id
    JOIN program_blocks pb ON pb.id = pw.block_id
    WHERE pb.client_id IN (SELECT id FROM clients WHERE coach_id = auth.uid())
  )
);
DROP POLICY IF EXISTS program_exercises_delete ON program_exercises;
CREATE POLICY program_exercises_delete ON program_exercises FOR DELETE USING (
  day_id IN (
    SELECT pd.id FROM program_days pd
    JOIN program_weeks pw ON pw.id = pd.week_id
    JOIN program_blocks pb ON pb.id = pw.block_id
    WHERE pb.client_id IN (SELECT id FROM clients WHERE coach_id = auth.uid())
  )
);

-- 11) client_engagement_events (coach select)
DROP POLICY IF EXISTS client_engagement_events_select_coach ON public.client_engagement_events;
CREATE POLICY client_engagement_events_select_coach ON public.client_engagement_events
  FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid()));

-- 12) nutrition_plans: derive coach via clients.coach_id (plan's client belongs to coach)
DROP POLICY IF EXISTS "Trainers CRUD own nutrition plans" ON public.nutrition_plans;
CREATE POLICY "Trainers CRUD own nutrition plans" ON public.nutrition_plans
  FOR ALL
  USING (client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid()))
  WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid()));

-- 13) nutrition_plan_weeks: same (weeks for plans whose client belongs to coach)
DROP POLICY IF EXISTS "Trainers CRUD own nutrition plan weeks" ON public.nutrition_plan_weeks;
CREATE POLICY "Trainers CRUD own nutrition plan weeks" ON public.nutrition_plan_weeks
  FOR ALL
  USING (
    plan_id IN (
      SELECT np.id FROM public.nutrition_plans np
      JOIN public.clients c ON c.id = np.client_id
      WHERE c.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    plan_id IN (
      SELECT np.id FROM public.nutrition_plans np
      JOIN public.clients c ON c.id = np.client_id
      WHERE c.coach_id = auth.uid()
    )
  );

-- 14) Views: use COALESCE(c.coach_id, c.trainer_id) so they work before/after coach_id backfill
DROP VIEW IF EXISTS public.v_coach_attention_queue;
CREATE VIEW public.v_coach_attention_queue
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
    SELECT mt.coach_id, mt.client_id, max(mm.created_at) AS last_msg_at
    FROM public.message_threads mt
    LEFT JOIN public.message_messages mm ON mm.thread_id = mt.id
    WHERE mt.deleted_at IS NULL
    GROUP BY mt.coach_id, mt.client_id
  ),
  has_flags AS (
    SELECT client_id, true AS has_active_flags
    FROM public.client_flags
    WHERE resolved_at IS NULL
    GROUP BY client_id
  )
SELECT
  COALESCE(c.coach_id, c.trainer_id) AS coach_id,
  c.id AS client_id,
  COALESCE(c.name, '')::text AS client_name,
  (
    (CASE WHEN (lc.week_start IS NULL OR lc.week_start <> (SELECT week_start FROM current_week_monday)) THEN 70 ELSE 0 END) +
    (CASE WHEN lc.submitted_at IS NOT NULL AND lc.submitted_at >= (now() - interval '48 hours') AND lc.reviewed_at IS NULL THEN 50 ELSE 0 END) +
    (CASE WHEN lc.compliance IS NOT NULL AND lc.compliance < 70 THEN 40 ELSE 0 END) +
    (CASE WHEN hf.has_active_flags THEN 30 ELSE 0 END) +
    (CASE WHEN lm.last_msg_at IS NULL OR lm.last_msg_at < (now() - interval '7 days') THEN 25 ELSE 0 END)
  )::integer AS attention_score,
  array_remove(ARRAY[
    CASE WHEN (lc.week_start IS NULL OR lc.week_start <> (SELECT week_start FROM current_week_monday)) THEN 'missed_checkin_this_week' END,
    CASE WHEN lc.submitted_at IS NOT NULL AND lc.submitted_at >= (now() - interval '48 hours') AND lc.reviewed_at IS NULL THEN 'new_checkin_last_48h' END,
    CASE WHEN lc.compliance IS NOT NULL AND lc.compliance < 70 THEN 'compliance_under_70' END,
    CASE WHEN hf.has_active_flags THEN 'has_active_flags' END,
    CASE WHEN lm.last_msg_at IS NULL OR lm.last_msg_at < (now() - interval '7 days') THEN 'no_message_in_7_days' END
  ], NULL) AS reasons,
  lc.submitted_at AS last_checkin_at,
  lc.compliance,
  COALESCE(hf.has_active_flags, false) AS has_active_flags
FROM public.clients c
LEFT JOIN latest_checkin lc ON lc.client_id = c.id
LEFT JOIN has_flags hf ON hf.client_id = c.id
LEFT JOIN last_message lm ON lm.coach_id = COALESCE(c.coach_id, c.trainer_id) AND lm.client_id = c.id;

COMMENT ON VIEW public.v_coach_attention_queue IS 'Per-coach client queue by attention_score. Query: WHERE coach_id = auth.uid() ORDER BY attention_score DESC.';

-- v_client_retention_risk
-- v_coach_review_queue (added in a later migration) depends on v_client_retention_risk; must drop first
-- so this migration can replace v_client_retention_risk. Later migrations in the chain recreate v_coach_review_queue.
DROP VIEW IF EXISTS public.v_coach_review_queue;
DROP VIEW IF EXISTS public.v_client_retention_risk;
CREATE VIEW public.v_client_retention_risk
WITH (security_invoker = on)
AS
WITH
  current_week_monday AS (
    SELECT (date_trunc('week', current_date)::date) AS week_start
  ),
  latest_checkin AS (
    SELECT v.client_id, v.week_start, v.submitted_at
    FROM public.v_client_latest_checkin v
  ),
  checkins_4w AS (
    SELECT client_id, count(*)::int AS cnt
    FROM public.checkins
    WHERE submitted_at >= (now() - interval '4 weeks')
    GROUP BY client_id
  ),
  messages_7d AS (
    SELECT mt.coach_id, mt.client_id, count(mm.id)::int AS cnt
    FROM public.message_threads mt
    JOIN public.message_messages mm ON mm.thread_id = mt.id
    WHERE mt.deleted_at IS NULL AND mm.created_at >= (now() - interval '7 days')
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
    SELECT client_id, score, row_number() OVER (PARTITION BY client_id ORDER BY recorded_at DESC) AS rn
    FROM compliance_scores
  ),
  compliance_trend_calc AS (
    SELECT a.client_id, (a.score - b.score)::numeric AS compliance_trend
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
    COALESCE(c.coach_id, c.trainer_id) AS coach_id,
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
  LEFT JOIN messages_7d m7 ON m7.coach_id = COALESCE(c.coach_id, c.trainer_id) AND m7.client_id = c.id
  LEFT JOIN compliance_trend_calc ct ON ct.client_id = c.id
) sub;

COMMENT ON VIEW public.v_client_retention_risk IS 'Retention risk per client. Query: WHERE coach_id = auth.uid() ORDER BY risk_score DESC.';
