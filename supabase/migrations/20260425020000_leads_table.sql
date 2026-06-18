-- Ensure public.leads exists for public profile conversion capture.
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid,
  trainer_id uuid,
  name text,
  email text,
  phone text,
  status text not null default 'new',
  source text not null default 'public_profile',
  goals_json jsonb,
  created_at timestamptz not null default now()
);

-- Backfill missing columns when table already existed from older schema.
alter table if exists public.leads
  add column if not exists coach_id uuid;

alter table if exists public.leads
  add column if not exists trainer_id uuid;

alter table if exists public.leads
  add column if not exists status text default 'new';

alter table if exists public.leads
  add column if not exists created_at timestamptz default now();

create index if not exists idx_leads_coach_id on public.leads (coach_id);
create index if not exists idx_leads_trainer_id on public.leads (trainer_id);
create index if not exists idx_leads_status on public.leads (status);
create index if not exists idx_leads_created_at on public.leads (created_at desc);
