/**
 * Free-text food search proxy (Open Food Facts).
 *
 * Browsers cannot call OFF's search endpoints directly — both
 * search.openfoodfacts.org and the legacy cgi/search.pl reject cross-origin
 * requests, so on web the in-app food search returned nothing at all
 * (Test 1 BUG-033). The product-by-barcode API does allow CORS, which is why
 * only search was dead. This function does the search server-side (where the
 * polite User-Agent belongs) and returns hits in the exact shape the client's
 * parseProductFromResponse already consumes.
 */
import { getCorsHeaders } from "../_shared/cors.ts";
import { getAuthUserId, jsonError } from "../_shared/auth.ts";
import { checkEdgeRateLimit } from "../_shared/publicSecurity.ts";

const OFF_UA = "AtlasPerformanceLabs/1.0 (support@atlasperformancelabs.app)";
const FIELDS = [
  "product_name",
  "nutriments",
  "serving_size",
  "product_quantity",
  "product_quantity_unit",
  "quantity",
  "nutrition_data_per",
  "brands",
  "image_front_url",
  "code",
].join(",");

async function searchSaL(q: string, pageSize: number): Promise<unknown[] | null> {
  try {
    const url = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=${pageSize}&fields=${encodeURIComponent(FIELDS)}`;
    const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": OFF_UA } });
    if (!res.ok) return null;
    const payload = await res.json();
    return Array.isArray(payload?.hits) ? payload.hits : null;
  } catch {
    return null;
  }
}

async function searchLegacyCgi(q: string, pageSize: number): Promise<unknown[] | null> {
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=${pageSize}&fields=${encodeURIComponent(FIELDS)}`;
    const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": OFF_UA } });
    if (!res.ok) return null;
    const payload = await res.json();
    return Array.isArray(payload?.products) ? payload.products : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  try {
    const callerId = await getAuthUserId(req);
    if (!callerId) return jsonError("Unauthorized", 401);

    const rate = await checkEdgeRateLimit({
      req,
      scope: "food-search",
      keyPart: callerId,
      maxHits: 30,
      windowSeconds: 60,
    });
    if (!rate.allowed) return jsonError("Too many requests", 429);

    const body = await req.json().catch(() => ({}));
    const q = String(body?.q ?? "").trim();
    const pageSize = Math.min(25, Math.max(1, Number(body?.pageSize) || 12));
    if (q.length < 2) return jsonError("Query too short", 400);

    const hits = (await searchSaL(q, pageSize)) ?? (await searchLegacyCgi(q, pageSize)) ?? [];

    return new Response(JSON.stringify({ hits }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("food-search error", error);
    return jsonError("Request failed", 500);
  }
});
