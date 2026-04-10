alter table public.profiles
  drop column if exists enhanced_trial_started_at,
  drop column if exists enhanced_trial_expires_at,
  drop column if exists has_used_trial;
alter table public.profiles
  drop column if exists enhanced_trial_started_at,
  drop column if exists enhanced_trial_expires_at,
  drop column if exists has_used_trial;
