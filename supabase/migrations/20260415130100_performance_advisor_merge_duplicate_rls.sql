-- Performance Advisor: merge overlapping permissive policies (same table + action + role).
--
-- 1) client_result_stories: two SELECT policies (own + public) become one for anon + authenticated.
--    Semantics: anon only matches is_public rows (auth.uid() is null). Authenticated coaches
--    match own rows or public rows.
-- 2) exercise_usage: v1 *_own policies duplicate v2 (coalesce(user_id, coach_id)); drop v1 only.

-- -----------------------------------------------------------------------------
-- client_result_stories: single SELECT policy
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS client_result_stories_select_own ON public.client_result_stories;
DROP POLICY IF EXISTS client_result_stories_select_public ON public.client_result_stories;

CREATE POLICY client_result_stories_select_readable ON public.client_result_stories
  FOR SELECT
  TO anon, authenticated
  USING (
    coach_id = (SELECT auth.uid())
    OR is_public = true
  );

-- -----------------------------------------------------------------------------
-- exercise_usage: remove redundant policies (superseded by *_v2)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS exercise_usage_select_own ON public.exercise_usage;
DROP POLICY IF EXISTS exercise_usage_insert_own ON public.exercise_usage;
DROP POLICY IF EXISTS exercise_usage_update_own ON public.exercise_usage;
