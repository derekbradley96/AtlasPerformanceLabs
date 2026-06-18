// Lightweight health check for Edge Functions (DEV badge ping). Returns 200.
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
});
