-- Crowd-sourced barcode → product cache. When a scan misses Open Food Facts and
-- a user fills in the nutrition by hand, we save it here keyed by barcode so the
-- next person who scans that barcode gets it prefilled. OFF stays the primary
-- source; this is only consulted as a fallback when OFF has no match, so bad
-- community data can't override verified OFF entries.
--
-- Shared catalog (not per-user): any authenticated user may read all rows and
-- contribute. Macros are stored per-100g (the canonical form) so any serving
-- size can be recomputed on lookup.

CREATE TABLE IF NOT EXISTS public.barcode_products (
  barcode text PRIMARY KEY,
  name text NOT NULL,
  brands text,
  calories_per_100g numeric,
  protein_per_100g numeric,
  carbs_per_100g numeric,
  fats_per_100g numeric,
  serving_size_grams numeric,
  serving_size text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  scan_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.barcode_products ENABLE ROW LEVEL SECURITY;

-- Any signed-in user can read the shared catalog.
DROP POLICY IF EXISTS barcode_products_read_authed ON public.barcode_products;
CREATE POLICY barcode_products_read_authed
  ON public.barcode_products
  FOR SELECT
  TO authenticated
  USING (( SELECT auth.uid() ) IS NOT NULL);

-- Any signed-in user can contribute a product (created_by must be themselves).
DROP POLICY IF EXISTS barcode_products_insert_authed ON public.barcode_products;
CREATE POLICY barcode_products_insert_authed
  ON public.barcode_products
  FOR INSERT
  TO authenticated
  WITH CHECK (( SELECT auth.uid() ) = created_by);

-- UPDATE needed for the upsert (bump scan_count / correct macros on re-scan).
DROP POLICY IF EXISTS barcode_products_update_authed ON public.barcode_products;
CREATE POLICY barcode_products_update_authed
  ON public.barcode_products
  FOR UPDATE
  TO authenticated
  USING (( SELECT auth.uid() ) IS NOT NULL)
  WITH CHECK (( SELECT auth.uid() ) IS NOT NULL);

GRANT SELECT, INSERT, UPDATE ON public.barcode_products TO authenticated;
