-- Personal → client invite handoff: when a personal user joins a coach by invite
-- code, their own program_blocks must be reassigned to the new coach so the coach
-- can see their training history. The former-personal user cannot do this via a
-- direct UPDATE — program_blocks' RLS WITH CHECK requires coach_id = auth.uid()
-- (or the block's client_id to belong to a client the caller coaches), so setting
-- coach_id to the coach's id is rejected. The handoff therefore silently failed
-- (caught + warned as non-fatal) and coaches never saw invited clients' history.
--
-- This SECURITY DEFINER RPC performs the reassignment server-side, scoped to the
-- caller's OWN personal blocks (owner_profile_id = auth.uid() and coach_id =
-- auth.uid()) and only to a coach the caller is actually linked to.
create or replace function public.handoff_personal_blocks_to_coach(p_coach_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_coach_id is null then
    raise exception 'coach id required';
  end if;
  -- Only hand off to a coach this user is genuinely linked to.
  if not exists (
    select 1 from public.clients
    where user_id = auth.uid()
      and (coach_id = p_coach_id or trainer_id = p_coach_id)
  ) then
    raise exception 'not linked to this coach';
  end if;

  update public.program_blocks
    set coach_id = p_coach_id
    where owner_profile_id = auth.uid()
      and coach_id = auth.uid();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.handoff_personal_blocks_to_coach(uuid) from public;
grant execute on function public.handoff_personal_blocks_to_coach(uuid) to authenticated;
