create table if not exists public.exercise_usage (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  exercise_name text not null,
  usage_count integer not null default 0,
  last_used_at timestamptz not null default now(),
  last_sets integer,
  last_reps text,
  last_rest_seconds integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists exercise_usage_coach_name_key
  on public.exercise_usage (coach_id, exercise_name);

create index if not exists exercise_usage_coach_recent_idx
  on public.exercise_usage (coach_id, last_used_at desc);

create index if not exists exercise_usage_coach_count_idx
  on public.exercise_usage (coach_id, usage_count desc);

alter table public.exercise_usage enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'exercise_usage'
      and policyname = 'exercise_usage_select_own'
  ) then
    create policy exercise_usage_select_own
      on public.exercise_usage
      for select
      using (auth.uid() = coach_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'exercise_usage'
      and policyname = 'exercise_usage_insert_own'
  ) then
    create policy exercise_usage_insert_own
      on public.exercise_usage
      for insert
      with check (auth.uid() = coach_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'exercise_usage'
      and policyname = 'exercise_usage_update_own'
  ) then
    create policy exercise_usage_update_own
      on public.exercise_usage
      for update
      using (auth.uid() = coach_id)
      with check (auth.uid() = coach_id);
  end if;
end
$$;

