-- Push token lifecycle. Two defects made push delivery impossible:
-- 1) nothing ever called registration, and 2) even if it had, the client
-- upsert targeted ON CONFLICT (user_id, device_token, platform) with no
-- matching unique constraint, so the insert would have errored anyway.

create unique index if not exists device_push_tokens_user_token_platform_key
  on public.device_push_tokens (user_id, device_token, platform);

-- A device token belongs to exactly one signed-in user. Claiming it revokes
-- any previous user's registration for the same token (shared or handed-down
-- devices) — RLS is own-rows-only, so this cross-user cleanup must run with
-- definer rights, scoped strictly to the caller's own claim.
create or replace function public.claim_device_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if coalesce(trim(p_token), '') = '' then
    return;
  end if;
  delete from device_push_tokens
   where device_token = p_token
     and user_id <> auth.uid();
  insert into device_push_tokens (user_id, device_token, platform)
  values (auth.uid(), p_token, coalesce(nullif(trim(p_platform), ''), 'unknown'))
  on conflict (user_id, device_token, platform) do nothing;
end;
$$;

revoke all on function public.claim_device_push_token(text, text) from anon;
grant execute on function public.claim_device_push_token(text, text) to authenticated;
