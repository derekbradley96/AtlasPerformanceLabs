-- Canonical schema for Motion app: trainers, clients, checkins, lifts, invoices, leads, program_assignments, milestones, closeouts

-- 1. trainers
CREATE TABLE IF NOT EXISTS trainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  stripe_account_id TEXT,
  stripe_connected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trainers_user_id ON trainers(user_id);

-- 2. clients
CREATE TYPE client_phase AS ENUM ('bulk', 'cut', 'maintenance');
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phase client_phase NOT NULL DEFAULT 'maintenance',
  phase_started_at TIMESTAMPTZ,
  baseline_weight NUMERIC,
  gym_name TEXT,
  gym_equipment_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clients_trainer_id ON clients(trainer_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at);

-- 3. checkins
CREATE TABLE IF NOT EXISTS checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  weight_avg NUMERIC,
  adherence_pct NUMERIC,
  steps_avg NUMERIC,
  sleep_avg NUMERIC,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_checkins_client_id ON checkins(client_id);
CREATE INDEX IF NOT EXISTS idx_checkins_created_at ON checkins(created_at);

-- 4. lifts (optional)
CREATE TABLE IF NOT EXISTS lifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lift_key TEXT NOT NULL,
  value NUMERIC NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lifts_client_id ON lifts(client_id);
CREATE INDEX IF NOT EXISTS idx_lifts_created_at ON lifts(created_at);

-- 5. invoices
CREATE TYPE invoice_status AS ENUM ('draft', 'pending', 'paid', 'overdue');
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  status invoice_status NOT NULL DEFAULT 'pending',
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_trainer_id ON invoices(trainer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- 6. leads
CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'booked', 'converted', 'lost');
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  status lead_status NOT NULL DEFAULT 'new',
  source TEXT NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  instagram TEXT,
  goals_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leads_trainer_id ON leads(trainer_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);

-- 7. programs (referenced by program_assignments)
CREATE TABLE IF NOT EXISTS programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID REFERENCES trainers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. program_assignments (versioned)
CREATE TABLE IF NOT EXISTS program_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  effective_date DATE NOT NULL,
  change_log TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_program_assignments_client_id ON program_assignments(client_id);

-- 9. milestones
CREATE TABLE IF NOT EXISTS milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  key TEXT NOT NULL,
  achieved_at TIMESTAMPTZ NOT NULL,
  value_json JSONB
);
CREATE INDEX IF NOT EXISTS idx_milestones_client_id ON milestones(client_id);

-- 10. closeouts
CREATE TABLE IF NOT EXISTS closeouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  focus_score NUMERIC,
  streak INT,
  totals_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_closeouts_trainer_id ON closeouts(trainer_id);
CREATE INDEX IF NOT EXISTS idx_closeouts_date ON closeouts(date);

-- trainers.slug for onboarding link (unique)
ALTER TABLE trainers ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_trainers_slug ON trainers(slug) WHERE slug IS NOT NULL;
