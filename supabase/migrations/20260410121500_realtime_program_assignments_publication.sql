-- Client dashboard: invalidate program queries when coach assigns/updates blocks.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'program_block_assignments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.program_block_assignments;
  END IF;
END $$;
