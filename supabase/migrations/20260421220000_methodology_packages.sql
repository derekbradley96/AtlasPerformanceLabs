create table if not exists public.methodology_packages (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  onboarding_message text,
  program_ids uuid[] not null default '{}',
  checkin_template_id uuid,
  nutrition_formula text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.methodology_packages enable row level security;

drop policy if exists "methodology_packages_coach_select" on public.methodology_packages;
create policy "methodology_packages_coach_select"
on public.methodology_packages
for select
to authenticated
using (coach_id = auth.uid());

drop policy if exists "methodology_packages_coach_insert" on public.methodology_packages;
create policy "methodology_packages_coach_insert"
on public.methodology_packages
for insert
to authenticated
with check (coach_id = auth.uid());

drop policy if exists "methodology_packages_coach_update" on public.methodology_packages;
create policy "methodology_packages_coach_update"
on public.methodology_packages
for update
to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

drop policy if exists "methodology_packages_coach_delete" on public.methodology_packages;
create policy "methodology_packages_coach_delete"
on public.methodology_packages
for delete
to authenticated
using (coach_id = auth.uid());
