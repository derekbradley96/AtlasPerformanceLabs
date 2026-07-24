-- GLP-1 support as a first-class check-in goal type.
-- Both focus_type CHECK constraints (checkin_templates 20260601000002,
-- checkins 20260601000001) allow only transformation|competition|integrated|
-- general; constraint names may be auto-generated, so find them by definition.
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT conrelid::regclass::text AS table_name, conname
    FROM pg_constraint
    WHERE contype = 'c'
      AND conrelid IN ('public.checkin_templates'::regclass, 'public.checkins'::regclass)
      AND pg_get_constraintdef(oid) ILIKE '%focus_type%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', con.table_name, con.conname);
  END LOOP;
END $$;

ALTER TABLE public.checkin_templates
  ADD CONSTRAINT checkin_templates_focus_type_check
  CHECK (focus_type IN ('transformation', 'competition', 'integrated', 'general', 'glp1'));

ALTER TABLE public.checkins
  ADD CONSTRAINT checkins_focus_type_check
  CHECK (focus_type IN ('transformation', 'competition', 'integrated', 'general', 'glp1'));
