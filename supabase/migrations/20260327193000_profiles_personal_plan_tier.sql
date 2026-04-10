alter table public.profiles
  add column if not exists personal_plan_tier text;

update public.profiles
set personal_plan_tier = case
  when lower(coalesce(personal_plan_tier, '')) in ('enhanced', 'personal_enhanced') then 'enhanced'
  when lower(coalesce(personal_plan_tier, '')) in ('basic', 'personal_basic') then 'basic'
  when lower(coalesce(plan_tier, '')) in ('pro', 'elite') then 'enhanced'
  else 'basic'
end
where lower(coalesce(role, '')) in ('personal', 'solo', 'athlete');

alter table public.profiles
  alter column personal_plan_tier set default 'basic';

alter table public.profiles
  drop constraint if exists profiles_personal_plan_tier_check;

alter table public.profiles
  add constraint profiles_personal_plan_tier_check
  check (personal_plan_tier in ('basic', 'enhanced'));

