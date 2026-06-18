alter table public.profiles
  add column if not exists athlete_dev_score integer,
  add column if not exists athlete_dev_score_updated_at timestamptz;
