alter table public.exercise_library
  add column if not exists slug text,
  add column if not exists display_name text,
  add column if not exists status text not null default 'active',
  add column if not exists primary_muscles text[] not null default '{}',
  add column if not exists stabilizer_muscles text[] not null default '{}',
  add column if not exists equipment_primary text,
  add column if not exists equipment_secondary text[] not null default '{}',
  add column if not exists equipment_category text,
  add column if not exists body_position text,
  add column if not exists skill_requirement text,
  add column if not exists fatigue_cost text,
  add column if not exists stability_demand text,
  add column if not exists loading_profile text,
  add column if not exists unilateral_type text,
  add column if not exists program_roles text[] not null default '{}',
  add column if not exists best_for_goals text[] not null default '{}',
  add column if not exists best_in_session_window text[] not null default '{}',
  add column if not exists gym_context_tags text[] not null default '{}',
  add column if not exists body_context_tags text[] not null default '{}',
  add column if not exists prep_context_tags text[] not null default '{}',
  add column if not exists description text;

update public.exercise_library
set
  display_name = coalesce(nullif(display_name, ''), name),
  slug = coalesce(nullif(slug, ''), lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))),
  primary_muscles = case
    when cardinality(primary_muscles) > 0 then primary_muscles
    when primary_muscle is not null and primary_muscle <> '' then array[primary_muscle]
    else '{}'::text[]
  end
where true;

create unique index if not exists exercise_library_slug_key
  on public.exercise_library (slug);

create table if not exists public.exercise_aliases (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercise_library(id) on delete cascade,
  alias text not null,
  alias_normalized text not null,
  source text not null default 'atlas',
  created_at timestamptz not null default now(),
  unique (exercise_id, alias_normalized)
);

create index if not exists exercise_aliases_alias_norm_idx
  on public.exercise_aliases (alias_normalized);

create table if not exists public.exercise_substitutions (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercise_library(id) on delete cascade,
  substitute_exercise_id uuid not null references public.exercise_library(id) on delete cascade,
  relation_type text not null,
  score numeric not null default 0.75,
  reason text,
  created_at timestamptz not null default now(),
  unique (exercise_id, substitute_exercise_id, relation_type)
);

create index if not exists exercise_substitutions_exercise_idx
  on public.exercise_substitutions (exercise_id, relation_type, score desc);

create table if not exists public.exercise_media (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercise_library(id) on delete cascade,
  media_type text not null default 'image',
  url text not null,
  caption text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists exercise_media_exercise_idx
  on public.exercise_media (exercise_id, is_primary desc);

create table if not exists public.exercise_template_links (
  id uuid primary key default gen_random_uuid(),
  template_kind text not null,
  template_id text not null,
  exercise_id uuid not null references public.exercise_library(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (template_kind, template_id, exercise_id)
);

create index if not exists exercise_template_links_template_idx
  on public.exercise_template_links (template_kind, template_id);

alter table public.exercise_aliases enable row level security;
alter table public.exercise_substitutions enable row level security;
alter table public.exercise_media enable row level security;
alter table public.exercise_template_links enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='exercise_aliases' and policyname='exercise_aliases_read_all_authed'
  ) then
    create policy exercise_aliases_read_all_authed
      on public.exercise_aliases
      for select
      using (auth.uid() is not null);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='exercise_substitutions' and policyname='exercise_substitutions_read_all_authed'
  ) then
    create policy exercise_substitutions_read_all_authed
      on public.exercise_substitutions
      for select
      using (auth.uid() is not null);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='exercise_media' and policyname='exercise_media_read_all_authed'
  ) then
    create policy exercise_media_read_all_authed
      on public.exercise_media
      for select
      using (auth.uid() is not null);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='exercise_template_links' and policyname='exercise_template_links_read_all_authed'
  ) then
    create policy exercise_template_links_read_all_authed
      on public.exercise_template_links
      for select
      using (auth.uid() is not null);
  end if;
end
$$;

