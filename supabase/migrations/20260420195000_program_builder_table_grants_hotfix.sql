-- Program builder grants hotfix:
-- Ensure authenticated users can access program tables; RLS still enforces row-level ownership.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.program_blocks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.program_weeks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.program_days TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.program_exercises TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.program_block_assignments TO authenticated;
