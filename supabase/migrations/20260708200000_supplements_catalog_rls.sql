-- Supplement protocol feature: the shared supplements catalog (name/description/
-- category — no per-user or sensitive data) shipped with RLS on and ZERO
-- policies, so it denied all reads/writes and the whole supplement-stack
-- feature came up empty. Any signed-in user may read it; coaches add custom
-- entries by inserting (the builder's "add your own" flow). No update/delete
-- of shared catalog rows from the client to avoid mutation of others' entries.
-- The per-client protocol (client_supplements) and adherence (supplement_logs)
-- already have correct coach-or-client policies.
alter table public.supplements enable row level security;

drop policy if exists supplements_select_authenticated on public.supplements;
create policy supplements_select_authenticated on public.supplements
  for select
  using (auth.uid() is not null);

drop policy if exists supplements_insert_authenticated on public.supplements;
create policy supplements_insert_authenticated on public.supplements
  for insert
  with check (auth.uid() is not null);
