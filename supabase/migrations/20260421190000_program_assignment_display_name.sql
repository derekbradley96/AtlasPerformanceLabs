-- Personalised client-facing program names for assignments.
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'program_block_assignments'
  ) then
    alter table public.program_block_assignments
      add column if not exists client_display_name text;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'program_assignments'
  ) then
    alter table public.program_assignments
      add column if not exists client_display_name text;
  end if;
end
$$;
