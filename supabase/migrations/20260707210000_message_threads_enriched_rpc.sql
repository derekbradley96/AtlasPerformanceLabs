-- Inbox enrichment in one round trip. listThreads previously ran 2 queries per
-- thread (last message + unread count) — the badge poll alone was ~2N queries
-- per minute for a coach with N clients. SECURITY INVOKER so the caller's RLS
-- on message_threads/message_messages still applies.
create or replace function public.message_threads_enriched(p_thread_ids uuid[])
returns table (
  thread_id uuid,
  last_message_text text,
  last_message_type text,
  last_duration_ms integer,
  last_message_at timestamptz,
  unread_for_coach integer,
  unread_for_client integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    t.id as thread_id,
    lm.message_text as last_message_text,
    lm.message_type as last_message_type,
    lm.duration_ms as last_duration_ms,
    lm.created_at as last_message_at,
    (
      select count(*) from message_messages m
      where m.thread_id = t.id
        and m.sender_role = 'client'
        and (t.coach_last_read_at is null or m.created_at > t.coach_last_read_at)
    )::int as unread_for_coach,
    (
      select count(*) from message_messages m
      where m.thread_id = t.id
        and m.sender_role = 'coach'
        and (t.client_last_read_at is null or m.created_at > t.client_last_read_at)
    )::int as unread_for_client
  from message_threads t
  left join lateral (
    select m.message_text, m.message_type, m.duration_ms, m.created_at
    from message_messages m
    where m.thread_id = t.id
    order by m.created_at desc
    limit 1
  ) lm on true
  where t.id = any(p_thread_ids)
$$;

-- Supporting index: last-message lookup and unread counts both scan by thread + recency.
create index if not exists message_messages_thread_created_idx
  on public.message_messages (thread_id, created_at desc);
