/**
 * ICE server config for WebRTC calls, served to authenticated users only.
 *
 * TURN credentials must never ship in the client bundle: VITE_ vars are
 * inlined into public JS, so anyone could lift long-lived relay credentials
 * and run traffic on Atlas' bill. They live here as function secrets
 * (TURN_URLS comma-separated, TURN_USERNAME, TURN_CREDENTIAL) and are handed
 * out per-request to signed-in users. Swapping to per-user ephemeral
 * credentials later (Twilio NTS / Cloudflare / coturn REST API) only changes
 * this function — no client change.
 */
import { getCorsHeaders } from "../_shared/cors.ts";
import { getAuthUserId, jsonError } from "../_shared/auth.ts";
import { checkEdgeRateLimit } from "../_shared/publicSecurity.ts";

type IceServer = { urls: string[]; username?: string; credential?: string };

const STUN_SERVERS: IceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  if (req.method !== "POST" && req.method !== "GET") return jsonError("Method not allowed", 405);

  try {
    const callerId = await getAuthUserId(req);
    if (!callerId) return jsonError("Unauthorized", 401);

    const rate = await checkEdgeRateLimit({
      req,
      scope: "turn-credentials",
      keyPart: callerId,
      maxHits: 30,
      windowSeconds: 60,
    });
    if (!rate.allowed) return jsonError("Too many requests", 429);

    const iceServers = [...STUN_SERVERS];
    const urls = (Deno.env.get("TURN_URLS") ?? "")
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);
    const username = (Deno.env.get("TURN_USERNAME") ?? "").trim();
    const credential = (Deno.env.get("TURN_CREDENTIAL") ?? "").trim();
    if (urls.length && username && credential) {
      iceServers.push({ urls, username, credential });
    }

    return new Response(JSON.stringify({ iceServers }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("turn-credentials error", error);
    return jsonError("Request failed", 500);
  }
});
