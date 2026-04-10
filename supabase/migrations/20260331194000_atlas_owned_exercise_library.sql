create table if not exists public.exercise_library (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  aliases text[] not null default '{}',
  primary_muscle text,
  secondary_muscles text[] not null default '{}',
  equipment text[] not null default '{}',
  movement_pattern text,
  difficulty text,
  exercise_type text,
  instructions text,
  coaching_cues text,
  substitutions text[] not null default '{}',
  tags text[] not null default '{}',
  is_unilateral boolean not null default false,
  is_bodyweight boolean not null default false,
  is_machine boolean not null default false,
  is_dumbbell boolean not null default false,
  is_barbell boolean not null default false,
  source text not null default 'atlas',
  source_external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists exercise_library_name_key on public.exercise_library (name);
create index if not exists exercise_library_name_idx on public.exercise_library (name);
create index if not exists exercise_library_source_external_idx on public.exercise_library (source, source_external_id);

alter table public.program_exercises
  add column if not exists exercise_library_id uuid references public.exercise_library(id) on delete set null;

alter table public.exercise_usage
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists exercise_id uuid references public.exercise_library(id) on delete cascade;

alter table public.exercise_usage
  add column if not exists last_sets integer,
  add column if not exists last_reps text,
  add column if not exists last_rest_seconds integer;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'exercise_usage' and column_name = 'coach_id'
  ) then
    update public.exercise_usage
    set user_id = coach_id
    where user_id is null;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'exercise_usage' and column_name = 'exercise_name'
  ) then
    update public.exercise_usage eu
    set exercise_id = el.id
    from public.exercise_library el
    where eu.exercise_id is null
      and lower(trim(coalesce(eu.exercise_name, ''))) = lower(trim(coalesce(el.name, '')));
  end if;
end
$$;

create unique index if not exists exercise_usage_user_exercise_key
  on public.exercise_usage (user_id, exercise_id)
  where user_id is not null and exercise_id is not null;

create table if not exists public.exercise_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid not null references public.exercise_library(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, exercise_id)
);

create index if not exists exercise_favorites_user_idx on public.exercise_favorites (user_id, created_at desc);

alter table public.exercise_library enable row level security;
alter table public.exercise_favorites enable row level security;
alter table public.exercise_usage enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='exercise_library' and policyname='exercise_library_read_all_authed'
  ) then
    create policy exercise_library_read_all_authed
      on public.exercise_library
      for select
      using (auth.uid() is not null);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='exercise_favorites' and policyname='exercise_favorites_select_own'
  ) then
    create policy exercise_favorites_select_own
      on public.exercise_favorites
      for select
      using (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='exercise_favorites' and policyname='exercise_favorites_insert_own'
  ) then
    create policy exercise_favorites_insert_own
      on public.exercise_favorites
      for insert
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='exercise_favorites' and policyname='exercise_favorites_delete_own'
  ) then
    create policy exercise_favorites_delete_own
      on public.exercise_favorites
      for delete
      using (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='exercise_usage' and policyname='exercise_usage_select_own_v2'
  ) then
    create policy exercise_usage_select_own_v2
      on public.exercise_usage
      for select
      using (auth.uid() = coalesce(user_id, coach_id));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='exercise_usage' and policyname='exercise_usage_insert_own_v2'
  ) then
    create policy exercise_usage_insert_own_v2
      on public.exercise_usage
      for insert
      with check (auth.uid() = coalesce(user_id, coach_id));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='exercise_usage' and policyname='exercise_usage_update_own_v2'
  ) then
    create policy exercise_usage_update_own_v2
      on public.exercise_usage
      for update
      using (auth.uid() = coalesce(user_id, coach_id))
      with check (auth.uid() = coalesce(user_id, coach_id));
  end if;
end
$$;

