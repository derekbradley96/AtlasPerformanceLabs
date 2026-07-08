-- SECURITY: two public tables shipped with RLS entirely disabled, so the
-- anon key (bundled in the app) could read AND write every row.
--   checkin_templates          — anon could list/insert/modify/delete every
--                                coach's templates (verified: anon INSERT → 201).
--   account_deletion_feedback  — anon could read every user's deletion reason.

-- 1) checkin_templates: coaches own their rows; their clients may read them.
alter table public.checkin_templates enable row level security;

drop policy if exists checkin_templates_coach_all on public.checkin_templates;
create policy checkin_templates_coach_all on public.checkin_templates
  for all
  using (coach_id = auth.uid() or trainer_id = auth.uid())
  with check (coach_id = auth.uid() or trainer_id = auth.uid());

-- Clients read the template they're assigned or one belonging to their coach —
-- ClientCheckIn resolves by clients.checkin_template_id, else the coach link.
drop policy if exists checkin_templates_client_read on public.checkin_templates;
create policy checkin_templates_client_read on public.checkin_templates
  for select
  using (
    exists (
      select 1 from public.clients c
      where c.user_id = auth.uid()
        and (
          c.checkin_template_id = checkin_templates.id
          or c.trainer_id = checkin_templates.coach_id
          or c.coach_id = checkin_templates.coach_id
          or c.trainer_id = checkin_templates.trainer_id
          or c.coach_id = checkin_templates.trainer_id
        )
    )
  );

-- 2) account_deletion_feedback: only the delete-account edge function
-- (service role, bypasses RLS) ever touches this. Enable RLS with no policy =
-- deny all for anon/authenticated, service role still writes.
alter table public.account_deletion_feedback enable row level security;
