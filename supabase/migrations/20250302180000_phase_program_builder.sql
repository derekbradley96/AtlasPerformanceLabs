-- Phase Engine + Program Builder 2.0 + Master Client Dashboard
-- Tables: client_phases, client_compliance, client_flags, program_blocks, program_weeks, program_days, program_exercises
-- View: v_client_master_dashboard

-- Enum for phase type (reuse existing client_phase if present; otherwise create phase_block_type for client_phases)
DO $$ BEGIN
  CREATE TYPE phase_block_type AS ENUM ('bulk', 'cut', 'maintenance', 'prep', 'deload');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Enum for exercise scheme
DO $$ BEGIN
  CREATE TYPE exercise_scheme_type AS ENUM ('straight', 'drop_set', 'rest_pause', 'cluster', 'emom', 'amrap', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Enum for flag severity (for client_flags)
DO $$ BEGIN
  CREATE TYPE flag_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1. client_phases (one row per phase block; latest = current phase)
CREATE TABLE IF NOT EXISTS client_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL,
  phase_type phase_block_type NOT NULL DEFAULT 'maintenance',
  block_length_weeks INT NOT NULL CHECK (block_length_weeks >= 1 AND block_length_weeks <= 52),
  start_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_phases_client_id ON client_phases(client_id);
CREATE INDEX IF NOT EXISTS idx_client_phases_coach_id ON client_phases(coach_id);
CREATE INDEX IF NOT EXISTS idx_client_phases_start_date ON client_phases(start_date DESC);
-- Ensure phase_type exists (e.g. if table was created earlier with different schema)
ALTER TABLE client_phases ADD COLUMN IF NOT EXISTS phase_type phase_block_type NOT NULL DEFAULT 'maintenance';
ALTER TABLE client_phases ADD COLUMN IF NOT EXISTS block_length_weeks INT NOT NULL DEFAULT 1;
ALTER TABLE client_phases ADD COLUMN IF NOT EXISTS start_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- 2. client_compliance (latest row = current adherence)
CREATE TABLE IF NOT EXISTS client_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  training_adherence_pct NUMERIC,
  nutrition_adherence_pct NUMERIC,
  notes TEXT
);
-- Ensure recorded_at exists (e.g. if table was created earlier with different schema)
ALTER TABLE client_compliance ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE client_compliance ADD COLUMN IF NOT EXISTS training_adherence_pct NUMERIC;
ALTER TABLE client_compliance ADD COLUMN IF NOT EXISTS nutrition_adherence_pct NUMERIC;
ALTER TABLE client_compliance ADD COLUMN IF NOT EXISTS notes TEXT;
CREATE INDEX IF NOT EXISTS idx_client_compliance_client_id ON client_compliance(client_id);
CREATE INDEX IF NOT EXISTS idx_client_compliance_recorded_at ON client_compliance(recorded_at DESC);

-- 3. client_flags (active flags for count + max severity)
CREATE TABLE IF NOT EXISTS client_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  severity flag_severity NOT NULL DEFAULT 'medium',
  label TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_flags_client_id ON client_flags(client_id);
CREATE INDEX IF NOT EXISTS idx_client_flags_resolved ON client_flags(client_id) WHERE resolved_at IS NULL;

-- 4. program_blocks
CREATE TABLE IF NOT EXISTS program_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES client_phases(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  total_weeks INT NOT NULL CHECK (total_weeks >= 1 AND total_weeks <= 52),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_program_blocks_client_id ON program_blocks(client_id);
CREATE INDEX IF NOT EXISTS idx_program_blocks_phase_id ON program_blocks(phase_id);

-- 5. program_weeks
CREATE TABLE IF NOT EXISTS program_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID NOT NULL REFERENCES program_blocks(id) ON DELETE CASCADE,
  week_number INT NOT NULL CHECK (week_number >= 1),
  UNIQUE(block_id, week_number)
);
CREATE INDEX IF NOT EXISTS idx_program_weeks_block_id ON program_weeks(block_id);

-- 6. program_days
CREATE TABLE IF NOT EXISTS program_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id UUID NOT NULL REFERENCES program_weeks(id) ON DELETE CASCADE,
  day_number INT NOT NULL CHECK (day_number >= 1 AND day_number <= 7),
  title TEXT NOT NULL DEFAULT '',
  UNIQUE(week_id, day_number)
);
CREATE INDEX IF NOT EXISTS idx_program_days_week_id ON program_days(week_id);

-- 7. program_exercises
CREATE TABLE IF NOT EXISTS program_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id UUID NOT NULL REFERENCES program_days(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL DEFAULT '',
  sets INT,
  reps INT,
  percentage NUMERIC,
  scheme exercise_scheme_type,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_program_exercises_day_id ON program_exercises(day_id);

-- 8. View: v_client_master_dashboard (one row per client with latest phase, week X of Y, adherence, flags)
DROP VIEW IF EXISTS v_client_master_dashboard;
CREATE VIEW v_client_master_dashboard AS
SELECT
  c.id AS client_id,
  latest_phase.phase_type,
  latest_phase.block_length_weeks AS total_weeks,
  latest_phase.start_date AS phase_start_date,
  CASE
    WHEN latest_phase.start_date IS NULL THEN NULL
    ELSE LEAST(
      GREATEST(1, FLOOR((CURRENT_DATE - latest_phase.start_date) / 7)::INT + 1),
      latest_phase.block_length_weeks
    )
  END AS current_week,
  latest_compliance.training_adherence_pct AS training_adherence,
  latest_compliance.nutrition_adherence_pct AS nutrition_adherence,
  COALESCE(flags_agg.flags_count, 0)::INT AS flags_count,
  flags_agg.flags_max_severity
FROM clients c
LEFT JOIN LATERAL (
  SELECT phase_type, block_length_weeks, start_date
  FROM client_phases
  WHERE client_id = c.id
  ORDER BY start_date DESC
  LIMIT 1
) latest_phase ON true
LEFT JOIN LATERAL (
  SELECT training_adherence_pct, nutrition_adherence_pct
  FROM client_compliance
  WHERE client_id = c.id
  ORDER BY recorded_at DESC
  LIMIT 1
) latest_compliance ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::INT AS flags_count,
    (ARRAY_AGG(f.severity ORDER BY (
      CASE WHEN f.severity::text IN ('critical','high','medium','low') THEN
        CASE f.severity::text WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END
      ELSE LEAST(4, GREATEST(0, COALESCE((f.severity)::int, 0)))
      END
    ) DESC NULLS LAST))[1] AS flags_max_severity
  FROM client_flags f
  WHERE f.client_id = c.id AND f.resolved_at IS NULL
) flags_agg ON true;

-- RLS: enable on new tables (policy: coach/trainer can access own clients)
ALTER TABLE client_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_compliance ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_exercises ENABLE ROW LEVEL SECURITY;

-- client_phases: coach_id = auth.uid() (auth.uid() is UUID in Supabase)
DROP POLICY IF EXISTS client_phases_select ON client_phases;
DROP POLICY IF EXISTS client_phases_insert ON client_phases;
CREATE POLICY client_phases_select ON client_phases FOR SELECT USING (
  coach_id = auth.uid() OR client_id IN (SELECT id FROM clients WHERE trainer_id = auth.uid())
);
CREATE POLICY client_phases_insert ON client_phases FOR INSERT WITH CHECK (coach_id = auth.uid());

-- client_compliance: access if client belongs to trainer
DROP POLICY IF EXISTS client_compliance_select ON client_compliance;
CREATE POLICY client_compliance_select ON client_compliance FOR SELECT USING (
  client_id IN (SELECT id FROM clients WHERE trainer_id = auth.uid())
);
DROP POLICY IF EXISTS client_compliance_insert ON client_compliance;
CREATE POLICY client_compliance_insert ON client_compliance FOR INSERT WITH CHECK (
  client_id IN (SELECT id FROM clients WHERE trainer_id = auth.uid())
);

-- client_flags: same
DROP POLICY IF EXISTS client_flags_select ON client_flags;
CREATE POLICY client_flags_select ON client_flags FOR SELECT USING (
  client_id IN (SELECT id FROM clients WHERE trainer_id = auth.uid())
);
DROP POLICY IF EXISTS client_flags_insert ON client_flags;
CREATE POLICY client_flags_insert ON client_flags FOR INSERT WITH CHECK (
  client_id IN (SELECT id FROM clients WHERE trainer_id = auth.uid())
);

-- program_blocks: access via client ownership
DROP POLICY IF EXISTS program_blocks_select ON program_blocks;
DROP POLICY IF EXISTS program_blocks_insert ON program_blocks;
CREATE POLICY program_blocks_select ON program_blocks FOR SELECT USING (
  client_id IN (SELECT id FROM clients WHERE trainer_id = auth.uid())
);
CREATE POLICY program_blocks_insert ON program_blocks FOR INSERT WITH CHECK (
  client_id IN (SELECT id FROM clients WHERE trainer_id = auth.uid())
);

-- program_weeks: via block -> client
DROP POLICY IF EXISTS program_weeks_select ON program_weeks;
DROP POLICY IF EXISTS program_weeks_insert ON program_weeks;
CREATE POLICY program_weeks_select ON program_weeks FOR SELECT USING (
  block_id IN (SELECT id FROM program_blocks WHERE client_id IN (SELECT id FROM clients WHERE trainer_id = auth.uid()))
);
CREATE POLICY program_weeks_insert ON program_weeks FOR INSERT WITH CHECK (
  block_id IN (SELECT id FROM program_blocks WHERE client_id IN (SELECT id FROM clients WHERE trainer_id = auth.uid()))
);

-- program_days: via week -> block -> client
DROP POLICY IF EXISTS program_days_select ON program_days;
DROP POLICY IF EXISTS program_days_insert ON program_days;
CREATE POLICY program_days_select ON program_days FOR SELECT USING (
  week_id IN (
    SELECT pw.id FROM program_weeks pw
    JOIN program_blocks pb ON pb.id = pw.block_id
    WHERE pb.client_id IN (SELECT id FROM clients WHERE trainer_id = auth.uid())
  )
);
CREATE POLICY program_days_insert ON program_days FOR INSERT WITH CHECK (
  week_id IN (
    SELECT pw.id FROM program_weeks pw
    JOIN program_blocks pb ON pb.id = pw.block_id
    WHERE pb.client_id IN (SELECT id FROM clients WHERE trainer_id = auth.uid())
  )
);

-- program_exercises: via day -> week -> block -> client
DROP POLICY IF EXISTS program_exercises_select ON program_exercises;
DROP POLICY IF EXISTS program_exercises_insert ON program_exercises;
DROP POLICY IF EXISTS program_exercises_update ON program_exercises;
DROP POLICY IF EXISTS program_exercises_delete ON program_exercises;
CREATE POLICY program_exercises_select ON program_exercises FOR SELECT USING (
  day_id IN (
    SELECT pd.id FROM program_days pd
    JOIN program_weeks pw ON pw.id = pd.week_id
    JOIN program_blocks pb ON pb.id = pw.block_id
    WHERE pb.client_id IN (SELECT id FROM clients WHERE trainer_id = auth.uid())
  )
);
CREATE POLICY program_exercises_insert ON program_exercises FOR INSERT WITH CHECK (
  day_id IN (
    SELECT pd.id FROM program_days pd
    JOIN program_weeks pw ON pw.id = pd.week_id
    JOIN program_blocks pb ON pb.id = pw.block_id
    WHERE pb.client_id IN (SELECT id FROM clients WHERE trainer_id = auth.uid())
  )
);
CREATE POLICY program_exercises_update ON program_exercises FOR UPDATE USING (
  day_id IN (
    SELECT pd.id FROM program_days pd
    JOIN program_weeks pw ON pw.id = pd.week_id
    JOIN program_blocks pb ON pb.id = pw.block_id
    WHERE pb.client_id IN (SELECT id FROM clients WHERE trainer_id = auth.uid())
  )
);
CREATE POLICY program_exercises_delete ON program_exercises FOR DELETE USING (
  day_id IN (
    SELECT pd.id FROM program_days pd
    JOIN program_weeks pw ON pw.id = pd.week_id
    JOIN program_blocks pb ON pb.id = pw.block_id
    WHERE pb.client_id IN (SELECT id FROM clients WHERE trainer_id = auth.uid())
  )
);
