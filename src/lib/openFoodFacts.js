// v2: adds is_liquid + ml-aware serving parsing; old cached entries lack them.
const OFF_CACHE_KEY = 'atlas.off.products.v2';
const OFF_CACHE_LIMIT = 40;
const OFF_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const OFF_USER_AGENT = 'AtlasPerformanceLabs/1.0 (support@atlasperformancelabs.app)';
const OFF_FIELDS = [
  'product_name',
  'nutriments',
  'serving_size',
  'product_quantity',
  'product_quantity_unit',
  'quantity',
  'nutrition_data_per',
  'brands',
  'image_front_url',
].join(',');

const inMemoryProducts = new Map();
const pendingLookups = new Map();

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function firstNumber(source, keys) {
  if (!source || typeof source !== 'object') return null;
  for (const key of keys) {
    const value = toFiniteNumber(source[key]);
    if (value != null) return value;
  }
  return null;
}

/**
 * Serving amount in the product's native per-100 unit (g for solids, ml for
 * liquids — OFF liquid nutriments are per 100ml, so no density guess is made).
 * Understands "330 ml", "75cl", "1 l"/"1 litre" (converted to ml) and "Ng".
 */
function parseServingAmount(servingSize, fallbackQuantity) {
  for (const raw of [servingSize, fallbackQuantity]) {
    const text = typeof raw === 'string' ? raw : '';
    if (!text) continue;
    const ml = text.match(/(\d+(?:[.,]\d+)?)\s*ml\b/i);
    if (ml) return { amount: toFiniteNumber(String(ml[1]).replace(',', '.')), unit: 'ml' };
    const cl = text.match(/(\d+(?:[.,]\d+)?)\s*cl\b/i);
    if (cl) {
      const n = toFiniteNumber(String(cl[1]).replace(',', '.'));
      return { amount: n != null ? n * 10 : null, unit: 'ml' };
    }
    const litres = text.match(/(\d+(?:[.,]\d+)?)\s*(?:l|litres?|liters?)\b/i);
    if (litres) {
      const n = toFiniteNumber(String(litres[1]).replace(',', '.'));
      return { amount: n != null ? n * 1000 : null, unit: 'ml' };
    }
    const grams = text.match(/(\d+(?:[.,]\d+)?)\s*g\b/i);
    if (grams) return { amount: toFiniteNumber(String(grams[1]).replace(',', '.')), unit: 'g' };
  }
  return { amount: null, unit: null };
}

/** Liquid when OFF says nutriments are per 100ml, the pack unit is volumetric, or the serving/pack text reads in ml/cl/l/fl oz. */
function detectLiquid(product, servingParse) {
  const per = String(product?.nutrition_data_per || '').toLowerCase();
  if (per.includes('ml')) return true;
  const unit = String(product?.product_quantity_unit || '').toLowerCase();
  if (unit === 'ml' || unit === 'cl' || unit === 'l') return true;
  if (servingParse?.unit === 'ml') return true;
  const text = `${product?.serving_size || ''} ${product?.quantity || ''}`.toLowerCase();
  return /fl\s*oz|fluid/.test(text);
}

function parseProductFromResponse(barcode, payload) {
  const product = payload?.product;
  if (!product || typeof product !== 'object') return null;
  const nutriments = product.nutriments || {};

  const caloriesPer100g = firstNumber(nutriments, [
    'energy-kcal_100g',
    'energy_kcal_100g',
    'energy-kcal',
    'energy_kcal',
  ]);
  const proteinPer100g = firstNumber(nutriments, ['proteins_100g', 'proteins']);
  const carbsPer100g = firstNumber(nutriments, ['carbohydrates_100g', 'carbohydrates']);
  const fatsPer100g = firstNumber(nutriments, ['fat_100g', 'fat']);

  const caloriesPerServing = firstNumber(nutriments, [
    'energy-kcal_serving',
    'energy_kcal_serving',
  ]);
  const proteinPerServing = firstNumber(nutriments, ['proteins_serving']);
  const carbsPerServing = firstNumber(nutriments, ['carbohydrates_serving']);
  const fatsPerServing = firstNumber(nutriments, ['fat_serving']);

  const servingParse = parseServingAmount(product.serving_size, product.quantity ?? product.product_quantity);
  const normalized = {
    barcode: String(barcode || '').trim(),
    name: String(product.product_name || '').trim() || 'Unnamed product',
    calories_per_100g: caloriesPer100g,
    protein_per_100g: proteinPer100g,
    carbs_per_100g: carbsPer100g,
    fats_per_100g: fatsPer100g,
    calories_per_serving: caloriesPerServing,
    protein_per_serving: proteinPerServing,
    carbs_per_serving: carbsPerServing,
    fats_per_serving: fatsPerServing,
    serving_size: String(product.serving_size || '').trim() || null,
    // Native per-100 unit amount: grams for solids, ml for liquids.
    serving_size_grams: servingParse.amount,
    is_liquid: detectLiquid(product, servingParse),
    image: String(product.image_front_url || '').trim() || null,
    brands: String(product.brands || '').trim() || null,
  };

  return normalized;
}

function parseOpenGroceryProduct(barcode, payload) {
  const product = payload?.product;
  if (!product || typeof product !== 'object') return null;
  const nutrients = product.nutrients || {};
  const caloriesPer100g = toFiniteNumber(nutrients.calories_per_100g);
  const proteinPer100g = toFiniteNumber(nutrients.protein_per_100g);
  const carbsPer100g = toFiniteNumber(nutrients.carbs_per_100g);
  const fatsPer100g = toFiniteNumber(nutrients.fat_per_100g);
  if (caloriesPer100g == null && proteinPer100g == null && carbsPer100g == null && fatsPer100g == null) {
    return null;
  }
  const servingParse = parseServingAmount(product.serving_size, product.quantity);
  return {
    barcode: String(barcode || '').trim(),
    name: String(product.name || '').trim() || 'Unnamed product',
    calories_per_100g: caloriesPer100g,
    protein_per_100g: proteinPer100g,
    carbs_per_100g: carbsPer100g,
    fats_per_100g: fatsPer100g,
    calories_per_serving: null,
    protein_per_serving: null,
    carbs_per_serving: null,
    fats_per_serving: null,
    serving_size: String(product.serving_size || '').trim() || null,
    serving_size_grams: servingParse.amount,
    is_liquid: detectLiquid(product, servingParse),
    image: String(product.image || '').trim() || null,
    brands: String(product.brand || '').trim() || null,
  };
}

function readStoredCache() {
  try {
    const raw = sessionStorage.getItem(OFF_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredCache(cacheObj) {
  try {
    sessionStorage.setItem(OFF_CACHE_KEY, JSON.stringify(cacheObj));
  } catch {
    // ignore storage limits
  }
}

function getCachedProduct(barcode) {
  const code = String(barcode || '').trim();
  if (!code) return null;

  const mem = inMemoryProducts.get(code);
  if (mem && Date.now() - mem.cachedAt < OFF_CACHE_TTL_MS) return mem.product;

  const cache = readStoredCache();
  const hit = cache[code];
  if (!hit || Date.now() - Number(hit.cachedAt || 0) > OFF_CACHE_TTL_MS) return null;
  inMemoryProducts.set(code, hit);
  return hit.product || null;
}

function setCachedProduct(barcode, product) {
  const code = String(barcode || '').trim();
  if (!code || !product) return;
  const entry = { product, cachedAt: Date.now() };
  inMemoryProducts.set(code, entry);

  const existing = readStoredCache();
  existing[code] = entry;
  const keys = Object.keys(existing).sort((a, b) => Number(existing[b]?.cachedAt || 0) - Number(existing[a]?.cachedAt || 0));
  while (keys.length > OFF_CACHE_LIMIT) {
    const oldKey = keys.pop();
    delete existing[oldKey];
  }
  writeStoredCache(existing);
}

function getApiUrl(barcode) {
  const clean = encodeURIComponent(String(barcode || '').trim());
  return `https://world.openfoodfacts.org/api/v2/product/${clean}?fields=${encodeURIComponent(OFF_FIELDS)}`;
}

function getApiV0Url(barcode) {
  const clean = encodeURIComponent(String(barcode || '').trim());
  return `https://world.openfoodfacts.org/api/v0/product/${clean}.json`;
}

function getOpenGroceryUrl(barcode) {
  const clean = encodeURIComponent(String(barcode || '').trim());
  return `https://api.opengrocery.net/api/v1/product/barcode/${clean}`;
}

async function fetchOffProduct(code, version) {
  const response = await fetch(version === 'v0' ? getApiV0Url(code) : getApiUrl(code), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': OFF_USER_AGENT,
    },
  });
  if (!response.ok) {
    return { ok: false, reason: 'http_error', retriableNotFound: true };
  }
  const payload = await response.json();
  if (!payload || payload.status !== 1 || !payload.product) {
    return { ok: false, reason: 'not_found', retriableNotFound: true };
  }
  const product = parseProductFromResponse(code, payload);
  if (!product) return { ok: false, reason: 'not_found', retriableNotFound: true };
  return { ok: true, product };
}

async function fetchOpenGroceryProduct(code) {
  const response = await fetch(getOpenGroceryUrl(code), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return { ok: false, reason: 'http_error' };
  const payload = await response.json();
  const product = parseOpenGroceryProduct(code, payload);
  if (!product) return { ok: false, reason: 'not_found' };
  return { ok: true, product };
}

const OFF_SEARCH_URL = 'https://search.openfoodfacts.org/search';
const OFF_SEARCH_FIELDS = ['product_name', 'nutriments', 'serving_size', 'product_quantity', 'product_quantity_unit', 'quantity', 'nutrition_data_per', 'brands', 'image_front_url', 'code'].join(',');
const searchCache = new Map();
const pendingSearches = new Map();
const SEARCH_CACHE_TTL_MS = 1000 * 60 * 30;

/**
 * Free-text food search (Open Food Facts search-a-licious API).
 * Returns products normalized to the same shape as barcode lookups; results
 * without calorie data are dropped (they can't be logged).
 */
export async function searchFoodProducts(query, { pageSize = 12 } = {}) {
  const q = String(query || '').trim();
  if (q.length < 2) return { ok: false, reason: 'query_too_short', products: [] };

  const cacheKey = `${q.toLowerCase()}|${pageSize}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.at < SEARCH_CACHE_TTL_MS) {
    return { ok: true, source: 'cache', products: cached.products };
  }
  if (pendingSearches.has(cacheKey)) return pendingSearches.get(cacheKey);

  const request = (async () => {
    try {
      // OFF's search endpoints reject cross-origin browser requests (the
      // product-by-barcode API allows them — which is why only search was
      // dead on web, Test 1 BUG-033). Route through our edge-function proxy
      // when Supabase is configured; fall back to the direct call, which
      // works in the native app where CORS does not apply.
      let hits = null;
      try {
        const { getSupabase } = await import('@/lib/supabaseClient');
        const sb = getSupabase();
        if (sb) {
          const { data, error } = await sb.functions.invoke('food-search', { body: { q, pageSize } });
          if (!error && Array.isArray(data?.hits)) hits = data.hits;
        }
      } catch {}
      if (!hits) {
        const url = `${OFF_SEARCH_URL}?q=${encodeURIComponent(q)}&page_size=${pageSize}&fields=${encodeURIComponent(OFF_SEARCH_FIELDS)}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) return { ok: false, reason: 'http_error', products: [] };
        const payload = await response.json();
        hits = Array.isArray(payload?.hits) ? payload.hits : [];
      }
      const products = hits
        .map((hit) => parseProductFromResponse(hit?.code || '', { product: hit }))
        .filter((p) => p && Number.isFinite(Number(p.calories_per_100g)));
      searchCache.set(cacheKey, { products, at: Date.now() });
      return { ok: true, source: 'off_search', products };
    } catch {
      return { ok: false, reason: 'network_error', products: [] };
    } finally {
      pendingSearches.delete(cacheKey);
    }
  })();

  pendingSearches.set(cacheKey, request);
  return request;
}

export async function fetchOpenFoodFactsProduct(barcode) {
  const code = String(barcode || '').trim();
  if (!code) {
    return { ok: false, reason: 'invalid_barcode', barcode: '', product: null };
  }

  const cached = getCachedProduct(code);
  if (cached) {
    return { ok: true, source: 'user_cache', barcode: code, product: { ...cached, source: 'user_cache' } };
  }

  if (pendingLookups.has(code)) {
    return pendingLookups.get(code);
  }

  const request = (async () => {
    try {
      const offV2 = await fetchOffProduct(code, 'v2');
      if (offV2.ok && offV2.product) {
        const product = { ...offV2.product, source: 'off_v2' };
        setCachedProduct(code, product);
        return { ok: true, source: 'off_v2', barcode: code, product };
      }

      if (offV2.reason === 'not_found' || offV2.reason === 'http_error') {
        const offV0 = await fetchOffProduct(code, 'v0');
        if (offV0.ok && offV0.product) {
          const product = { ...offV0.product, source: 'off_v0' };
          setCachedProduct(code, product);
          return { ok: true, source: 'off_v0', barcode: code, product };
        }
      }

      const openGrocery = await fetchOpenGroceryProduct(code);
      if (openGrocery.ok && openGrocery.product) {
        const product = { ...openGrocery.product, source: 'open_grocery' };
        setCachedProduct(code, product);
        return { ok: true, source: 'open_grocery', barcode: code, product };
      }

      return { ok: false, reason: 'not_found', barcode: code, product: null };
    } catch {
      return { ok: false, reason: 'network_error', barcode: code, product: null };
    } finally {
      pendingLookups.delete(code);
    }
  })();

  pendingLookups.set(code, request);
  return request;
}
