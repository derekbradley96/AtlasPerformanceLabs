-- Coach template / legacy client check-in: mood scale (1–10), distinct from energy_level.
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS mood_level INTEGER;

COMMENT ON COLUMN public.checkins.mood_level IS 'Client self-report mood (e.g. 1–10) from template check-in; pairs with energy_level and sleep_score.';
