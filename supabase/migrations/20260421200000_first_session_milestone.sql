-- First personal workout completion milestone.
alter table if exists public.profiles
  add column if not exists first_session_at timestamptz;
