-- Invite-code join was fully broken for the joining user: clients had only a
-- coach-scoped INSERT policy (clients_insert_own: COALESCE(coach_id,trainer_id)
-- = auth.uid()), so a personal/client user entering an invite code could not
-- create their own link row ({user_id: me, coach_id: coach}) — the insert hit
-- 42501 and applyInviteCodeForUser surfaced "Could not connect coach link yet."
--
-- The SELECT and UPDATE policies already trust user_id = auth.uid()
-- (pa_mg_* / clients_update_coach_or_athlete), so a user can already read and
-- update their own client link. This adds the matching INSERT policy so they can
-- create it — no new trust surface beyond what UPDATE already allows. The invite
-- code itself is validated in app code before this insert runs.
create policy clients_insert_self
  on public.clients
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));
