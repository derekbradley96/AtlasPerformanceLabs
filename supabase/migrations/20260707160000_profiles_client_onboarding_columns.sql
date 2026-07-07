-- Client onboarding asks for age, weight, goal, experience and injuries, and writes them
-- to profiles — but the columns never existed. updateProfile's missing-column retry was
-- silently stripping them, so every client's answers were collected and then discarded.
-- (goal/experience/injuries partially survived via the clients row created at finalize;
-- age and weight were lost entirely.)

alter table public.profiles
  add column if not exists age integer,
  add column if not exists weight_kg numeric,
  add column if not exists client_goal text,
  add column if not exists experience_level text,
  add column if not exists injuries_notes text;

comment on column public.profiles.age is 'Self-reported age from client onboarding.';
comment on column public.profiles.weight_kg is 'Self-reported current weight (kg) from client onboarding.';
comment on column public.profiles.client_goal is 'Goal id chosen in client onboarding (e.g. fat_loss, muscle_gain).';
comment on column public.profiles.experience_level is 'Training experience id chosen in client onboarding.';
comment on column public.profiles.injuries_notes is 'Free-text injuries/limitations from client onboarding.';
