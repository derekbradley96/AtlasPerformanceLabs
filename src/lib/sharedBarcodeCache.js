/**
 * Crowd-sourced barcode → product cache (public.barcode_products).
 * Consulted only as a fallback when Open Food Facts has no match, and written
 * when a user fills in a not-found barcode by hand — so the next scanner gets it.
 * Macros are stored per-100g so any serving can be recomputed.
 */
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Map a barcode_products row into the same shape Open Food Facts products use. */
function rowToProduct(row) {
  if (!row) return null;
  return {
    barcode: String(row.barcode || '').trim(),
    name: String(row.name || '').trim() || 'Unnamed product',
    brands: row.brands ? String(row.brands) : null,
    calories_per_100g: toNum(row.calories_per_100g),
    protein_per_100g: toNum(row.protein_per_100g),
    carbs_per_100g: toNum(row.carbs_per_100g),
    fats_per_100g: toNum(row.fats_per_100g),
    serving_size_grams: toNum(row.serving_size_grams),
    serving_size: row.serving_size ? String(row.serving_size) : null,
    image: null,
    source: 'community',
  };
}

/**
 * Look up a barcode in the shared community cache.
 * @returns {Promise<{ ok: boolean, product: object|null }>}
 */
export async function fetchSharedBarcodeProduct(barcode) {
  const clean = String(barcode || '').trim().replace(/\s+/g, '');
  if (!clean || !hasSupabase) return { ok: false, product: null };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, product: null };
  try {
    const { data, error } = await supabase
      .from('barcode_products')
      .select('*')
      .eq('barcode', clean)
      .maybeSingle();
    if (error || !data) return { ok: false, product: null };
    return { ok: true, product: rowToProduct(data) };
  } catch {
    return { ok: false, product: null };
  }
}

/**
 * Save/refresh a product in the shared cache (best-effort; never throws).
 * Skips rows with no usable per-100g calories so we don't pollute the catalog.
 * created_by is omitted on conflict-update path via the DB (kept unless a new
 * insert supplies it).
 * @param {{ barcode: string, userId: string, product: object }} args
 */
export async function upsertSharedBarcodeProduct({ barcode, userId, product }) {
  const clean = String(barcode || '').trim().replace(/\s+/g, '');
  const cal = toNum(product?.calories_per_100g);
  if (!clean || !userId || !hasSupabase || cal == null || cal <= 0) return { ok: false };
  const supabase = getSupabase();
  if (!supabase) return { ok: false };
  const row = {
    barcode: clean,
    name: String(product?.name || '').trim() || 'Unnamed product',
    brands: product?.brands ? String(product.brands) : null,
    calories_per_100g: cal,
    protein_per_100g: toNum(product?.protein_per_100g),
    carbs_per_100g: toNum(product?.carbs_per_100g),
    fats_per_100g: toNum(product?.fats_per_100g),
    serving_size_grams: toNum(product?.serving_size_grams),
    serving_size: product?.serving_size ? String(product.serving_size) : null,
    created_by: userId,
    updated_at: new Date().toISOString(),
  };
  try {
    const { error } = await supabase.from('barcode_products').upsert(row, { onConflict: 'barcode' });
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
