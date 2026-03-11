-- Weekly nutrition adjustments: plans per client and weekly macro rows.
-- Requires public.clients (id, trainer_id) to exist.

-- 1. Nutrition plans: one per trainer+client (getOrCreatePlan uses this).
create table if not exists public.nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null,
  client_id uuid not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (trainer_id, client_id)
);
create index if not exists idx_nutrition_plans_trainer_id on public.nutrition_plans(trainer_id);
create index if not exists idx_nutrition_plans_client_id on public.nutrition_plans(client_id);

-- 2. Weekly macro rows (one row per plan per week_start).
create table if not exists public.nutrition_plan_weeks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.nutrition_plans(id) on delete cascade,
  week_start date not null,
  phase text null,
  calories int4 null,
  protein int4 null,
  carbs int4 null,
  fats int4 null,
  notes text null,
  created_at timestamptz not null default now(),
  unique (plan_id, week_start)
);
create index if not exists idx_nutrition_plan_weeks_plan_week on public.nutrition_plan_weeks(plan_id, week_start desc);

-- 3. RLS on nutrition_plan_weeks
alter table public.nutrition_plan_weeks enable row level security;

-- Trainer: full CRUD on weeks whose plan belongs to them
create policy "Trainers CRUD own nutrition plan weeks"
  on public.nutrition_plan_weeks
  for all
  using (
    plan_id in (select id from public.nutrition_plans where trainer_id = auth.uid())
  )
  with check (
    plan_id in (select id from public.nutrition_plans where trainer_id = auth.uid())
  );

-- Client: SELECT only (read weeks for plans where they are the client).
-- Requires a way to know "current user is this client" (e.g. client_id in profiles or session).
-- TODO: When client auth mapping exists (e.g. profiles.client_id or link table), add:
--   create policy "Clients read own nutrition plan weeks"
--     on public.nutrition_plan_weeks for select
--     using (
--       plan_id in (
--         select np.id from public.nutrition_plans np
--         where np.client_id = auth.uid()  -- or (select client_id from profiles where id = auth.uid())
--       )
--     );
-- For now trainers can manage all; clients use trainer-shared view or same session.

-- 4. RLS on nutrition_plans so only trainers can insert/update/delete their own plans
alter table public.nutrition_plans enable row level security;

create policy "Trainers CRUD own nutrition plans"
  on public.nutrition_plans
  for all
  using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid());
