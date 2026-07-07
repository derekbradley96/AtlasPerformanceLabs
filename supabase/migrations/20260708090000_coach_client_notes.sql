-- Coach's private notes about a client. Previously localStorage-only
-- (atlas_client_notes_* / atlas_coach_notes_*): device-local, lost on browser
-- clear, never synced between the coach's phone and laptop.
-- Deliberately NOT columns on public.clients — the athlete can SELECT their
-- own clients row, and these notes are coach-private.
create table if not exists public.coach_client_notes (
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  quick_notes text,
  coach_notes text,
  updated_at timestamptz not null default now(),
  primary key (coach_id, client_id)
);

alter table public.coach_client_notes enable row level security;

create policy coach_client_notes_owner on public.coach_client_notes
  for all
  using (coach_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()));
