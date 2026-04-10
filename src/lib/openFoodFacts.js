const OFF_CACHE_KEY = 'atlas.off.products.v1';
const OFF_CACHE_LIMIT = 40;
const OFF_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const OFF_USER_AGENT = 'AtlasPerformanceLabs/1.0 (support@atlasperformancelabs.app)';
const OFF_FIELDS = [
  'product_name',
  'nutriments',
  'serving_size',
  'product_quantity',
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

function parseServingSizeGrams(servingSize, fallbackQuantity) {
  const servingText = typeof servingSize === 'string' ? servingSize : '';
  const quantityText = typeof fallbackQuantity === 'string' ? fallbackQuantity : '';
  const gramsMatch = servingText.match(/(\d+(?:[.,]\d+)?)\s*g/i) || quantityText.match(/(\d+(?:[.,]\d+)?)\s*g/i);
  if (!gramsMatch) return null;
  return toFiniteNumber(String(gramsMatch[1]).replace(',', '.'));
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
    serving_size_grams: parseServingSizeGrams(product.serving_size, product.product_quantity),
    image: String(product.image_front_url || '').trim() || null,
    brands: String(product.brands || '').trim() || null,
  };

  return normalized;
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

export async function fetchOpenFoodFactsProduct(barcode) {
  const code = String(barcode || '').trim();
  if (!code) {
    return { ok: false, reason: 'invalid_barcode', barcode: '', product: null };
  }

  const cached = getCachedProduct(code);
  if (cached) {
    return { ok: true, source: 'cache', barcode: code, product: cached };
  }

  if (pendingLookups.has(code)) {
    return pendingLookups.get(code);
  }

  const request = (async () => {
    try {
      const response = await fetch(getApiUrl(code), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': OFF_USER_AGENT,
        },
      });

      if (!response.ok) {
        return { ok: false, reason: 'http_error', barcode: code, product: null };
      }

      const payload = await response.json();
      if (!payload || payload.status !== 1 || !payload.product) {
        return { ok: false, reason: 'not_found', barcode: code, product: null };
      }

      const product = parseProductFromResponse(code, payload);
      if (!product) {
        return { ok: false, reason: 'not_found', barcode: code, product: null };
      }

      setCachedProduct(code, product);
      return { ok: true, source: 'network', barcode: code, product };
    } catch {
      return { ok: false, reason: 'network_error', barcode: code, product: null };
    } finally {
      pendingLookups.delete(code);
    }
  })();

  pendingLookups.set(code, request);
  return request;
}
