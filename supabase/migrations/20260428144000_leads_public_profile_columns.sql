-- Ensure leads supports public profile enquiry payload fields.
alter table if exists public.leads
  add column if not exists message text;

alter table if exists public.leads
  add column if not exists coach_id uuid;
