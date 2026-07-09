-- exercise_library is a shared reference catalog the app self-seeds from its
-- bundled exercise list via ensureAtlasExerciseLibrarySeeded() (an upsert run
-- from the program builder). RLS was enabled with only a SELECT policy and no
-- INSERT/UPDATE, so every seed attempt was silently denied — the catalog could
-- never populate, leaving DB-backed exercise search/usage/favourites ranking
-- and aliases/substitutions dead (the UI falls back to bundled data, so it was
-- invisible). Same failure mode as the supplements catalog fix.
--
-- The app only ever upserts the canonical bundled set here (deterministic,
-- onConflict=name); user-created custom exercises and favourites live in
-- localStorage and never touch this table. So allowing authenticated
-- insert/update is safe for the self-seed pattern.

-- INSERT: authenticated users may seed rows.
DROP POLICY IF EXISTS exercise_library_insert_authed ON public.exercise_library;
CREATE POLICY exercise_library_insert_authed
  ON public.exercise_library
  FOR INSERT
  TO authenticated
  WITH CHECK (( SELECT auth.uid() ) IS NOT NULL);

-- UPDATE: needed because the seed is an upsert (INSERT ... ON CONFLICT UPDATE).
DROP POLICY IF EXISTS exercise_library_update_authed ON public.exercise_library;
CREATE POLICY exercise_library_update_authed
  ON public.exercise_library
  FOR UPDATE
  TO authenticated
  USING (( SELECT auth.uid() ) IS NOT NULL)
  WITH CHECK (( SELECT auth.uid() ) IS NOT NULL);
