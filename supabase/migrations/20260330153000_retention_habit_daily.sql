-- Daily retention/habit checklist state (client + personal).
create table if not exists public.retention_habit_daily (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid null references public.clients(id) on delete cascade,
  day_date date not null,
  workout_completed boolean not null default false,
  nutrition_completed boolean not null default false,
  steps_completed boolean not null default false,
  water_completed boolean not null default false,
  checkin_completed boolean not null default false,
  posing_completed boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint retention_habit_daily_profile_day_unique unique (profile_id, day_date)
);

create index if not exists retention_habit_daily_profile_day_idx
  on public.retention_habit_daily (profile_id, day_date desc);

create index if not exists retention_habit_daily_client_day_idx
  on public.retention_habit_daily (client_id, day_date desc);

alter table public.retention_habit_daily enable row level security;

drop policy if exists "retention_habit_daily_self_select" on public.retention_habit_daily;
create policy "retention_habit_daily_self_select"
  on public.retention_habit_daily
  for select
  using (auth.uid() = profile_id);

drop policy if exists "retention_habit_daily_self_insert" on public.retention_habit_daily;
create policy "retention_habit_daily_self_insert"
  on public.retention_habit_daily
  for insert
  with check (auth.uid() = profile_id);

drop policy if exists "retention_habit_daily_self_update" on public.retention_habit_daily;
create policy "retention_habit_daily_self_update"
  on public.retention_habit_daily
  for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "retention_habit_daily_coach_select" on public.retention_habit_daily;
create policy "retention_habit_daily_coach_select"
  on public.retention_habit_daily
  for select
  using (
    client_id is not null
    and exists (
      select 1
      from public.clients c
      where c.id = retention_habit_daily.client_id
        and (
          c.trainer_id = auth.uid()
          or c.coach_id = auth.uid()
        )
    )
  );
