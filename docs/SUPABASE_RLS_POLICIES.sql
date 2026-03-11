-- =============================================================================
-- SUPABASE RLS POLICIES – Atlas Performance Labs
-- =============================================================================
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Ensure RLS is enabled on these tables. These policies fix:
--   - Boot failure "Couldn't finish loading" (profiles select blocked by RLS)
--   - Clients missing (clients table not readable by trainer)
--   - Check-ins not loading (checkins table not readable)
--
-- After running, trainers can:
--   - Read/update their own profile (profiles.id = auth.uid())
--   - CRUD clients where trainer_id = auth.uid()
--   - CRUD check-ins where trainer_id = auth.uid()
--   - CRUD nutrition_plans where trainer_id = auth.uid() (if table exists)
--
-- =============================================================================

-- 1) PROFILES: allow select/update/insert for own row (id = auth.uid())
--    Required so fetchProfile(session.user.id) returns the row after login.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- 2) CLIENTS: allow select/insert/update/delete where trainer_id = auth.uid()

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trainers can read own clients" ON public.clients;
CREATE POLICY "Trainers can read own clients"
  ON public.clients FOR SELECT
  USING (trainer_id = auth.uid());

DROP POLICY IF EXISTS "Trainers can insert own clients" ON public.clients;
CREATE POLICY "Trainers can insert own clients"
  ON public.clients FOR INSERT
  WITH CHECK (trainer_id = auth.uid());

DROP POLICY IF EXISTS "Trainers can update own clients" ON public.clients;
CREATE POLICY "Trainers can update own clients"
  ON public.clients FOR UPDATE
  USING (trainer_id = auth.uid());

DROP POLICY IF EXISTS "Trainers can delete own clients" ON public.clients;
CREATE POLICY "Trainers can delete own clients"
  ON public.clients FOR DELETE
  USING (trainer_id = auth.uid());

-- 3) CHECKINS: allow select/insert/update/delete where trainer_id = auth.uid()

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trainers can read own checkins" ON public.checkins;
CREATE POLICY "Trainers can read own checkins"
  ON public.checkins FOR SELECT
  USING (trainer_id = auth.uid());

DROP POLICY IF EXISTS "Trainers can insert own checkins" ON public.checkins;
CREATE POLICY "Trainers can insert own checkins"
  ON public.checkins FOR INSERT
  WITH CHECK (trainer_id = auth.uid());

DROP POLICY IF EXISTS "Trainers can update own checkins" ON public.checkins;
CREATE POLICY "Trainers can update own checkins"
  ON public.checkins FOR UPDATE
  USING (trainer_id = auth.uid());

DROP POLICY IF EXISTS "Trainers can delete own checkins" ON public.checkins;
CREATE POLICY "Trainers can delete own checkins"
  ON public.checkins FOR DELETE
  USING (trainer_id = auth.uid());

-- 4) NUTRITION_PLANS: same pattern if the table exists
--    Uncomment and run if your schema has nutrition_plans with trainer_id.

-- ALTER TABLE public.nutrition_plans ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Trainers can read own nutrition_plans" ON public.nutrition_plans;
-- CREATE POLICY "Trainers can read own nutrition_plans"
--   ON public.nutrition_plans FOR SELECT USING (trainer_id = auth.uid());
-- DROP POLICY IF EXISTS "Trainers can insert own nutrition_plans" ON public.nutrition_plans;
-- CREATE POLICY "Trainers can insert own nutrition_plans"
--   ON public.nutrition_plans FOR INSERT WITH CHECK (trainer_id = auth.uid());
-- DROP POLICY IF EXISTS "Trainers can update own nutrition_plans" ON public.nutrition_plans;
-- CREATE POLICY "Trainers can update own nutrition_plans"
--   ON public.nutrition_plans FOR UPDATE USING (trainer_id = auth.uid());
-- DROP POLICY IF EXISTS "Trainers can delete own nutrition_plans" ON public.nutrition_plans;
-- CREATE POLICY "Trainers can delete own nutrition_plans"
--   ON public.nutrition_plans FOR DELETE USING (trainer_id = auth.uid());
