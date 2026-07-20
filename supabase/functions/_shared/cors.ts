const ALLOWED_ORIGINS = [
  "https://atlasperformancelabs.co.uk",
  "https://www.atlasperformancelabs.co.uk",
  "https://atlas-performance-labs-app.vercel.app",
  // Native app WebView origins. WKWebView enforces CORS from the app's custom
  // scheme, so without these EVERY edge-function call from the iOS app died
  // with WebKit's "Load failed" (first seen on client signup's coach-code
  // check — the rest of the app talks to PostgREST, which has its own CORS,
  // which is why nothing else surfaced it).
  "capacitor://localhost", // iOS
  "https://localhost", // Android (default androidScheme)
  "http://localhost", // Android fallback
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
];

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
}

// Backward-compat fallback for shared helpers that do not receive Request.
export const corsHeaders = getCorsHeaders(
  new Request(ALLOWED_ORIGINS[0], { headers: { Origin: ALLOWED_ORIGINS[0] } })
);

export function respondOk(req: Request, body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...getCorsHeaders(req), ...init?.headers },
  });
}

export function respondErr(req: Request, message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
  });
}
