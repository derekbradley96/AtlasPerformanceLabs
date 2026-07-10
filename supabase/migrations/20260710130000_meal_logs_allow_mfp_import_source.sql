-- The MyFitnessPal importer writes meal_logs with source='mfp_import', but the
-- source CHECK constraint only allowed manual/barcode/quick_add/template — so
-- every imported row was rejected and the whole import silently failed. Allow
-- 'mfp_import' so imported meals land and stay attributable to the import.
ALTER TABLE public.meal_logs DROP CONSTRAINT IF EXISTS meal_logs_source_check;
ALTER TABLE public.meal_logs
  ADD CONSTRAINT meal_logs_source_check
  CHECK (source = ANY (ARRAY['manual'::text, 'barcode'::text, 'quick_add'::text, 'template'::text, 'mfp_import'::text]));
