-- Personal accounts: canonical tier `free` (fully featured). Legacy `basic` / `enhanced` remain valid for historical rows.

alter table public.profiles
  drop constraint if exists profiles_personal_plan_tier_check;

alter table public.profiles
  add constraint profiles_personal_plan_tier_check
  check (
    personal_plan_tier is null
    or lower(trim(personal_plan_tier)) in ('basic', 'enhanced', 'free')
  );

alter table public.profiles
  alter column personal_plan_tier set default 'free';
