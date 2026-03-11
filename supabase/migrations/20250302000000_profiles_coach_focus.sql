-- Add coach_focus to profiles. Single source for coaching focus: transformation | competition | integrated.
-- If your trigger already sets coach_type from raw_user_meta_data, add coach_focus the same way.
-- Backfill: coach_type fitness -> transformation, prep -> competition, hybrid -> integrated.

alter table public.profiles add column if not exists coach_focus text check (coach_focus in ('transformation', 'competition', 'integrated'));

-- Backfill from coach_type where coach_focus is null
update public.profiles
set coach_focus = case
  when coach_type = 'fitness' then 'transformation'
  when coach_type = 'prep' then 'competition'
  when coach_type = 'hybrid' then 'integrated'
  else 'transformation'
end
where coach_focus is null and coach_type is not null and coach_type != '';

comment on column public.profiles.coach_focus is 'Coaching focus: transformation | competition | integrated. Gates prep-only modules and dashboard defaults.';
