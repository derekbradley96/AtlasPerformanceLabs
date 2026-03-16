/**
 * Shared Stripe security helpers: redirect origin allowlist, webhook replay check, safe logging.
 * Never trust client-controlled redirect URLs or fee/price from client.
 */

const DEFAULT_ORIGINS = [
  "https://atlasperformancelabs.com",
  "https://www.atlasperformancelabs.com",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "capacitor://localhost",
];

/** Parse ALLOWED_STRIPE_REDIRECT_ORIGINS (comma-separated) or use defaults. No wildcards. */
export function getAllowedRedirectOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_STRIPE_REDIRECT_ORIGINS");
  if (!raw || typeof raw !== "string") return DEFAULT_ORIGINS;
  return raw
    .split(",")
    .map((o) => o.trim().toLowerCase())
    .filter((o) => o.length > 0 && !o.includes("*"));
}

/**
 * Get redirect base URL for success/cancel/return: only allowlisted origins.
 * Returns null if Origin/Referer is missing or not allowlisted (prevents open redirect).
 */
export function getAllowlistedRedirectOrigin(req: Request): string | null {
  const origin = (req.headers.get("Origin") ?? req.headers.get("Referer") ?? "").trim();
  if (!origin) return null;
  try {
    const url = new URL(origin);
    const base = `${url.protocol}//${url.host}`.toLowerCase();
    const allowed = getAllowedRedirectOrigins();
    if (allowed.includes(base)) return base.replace(/\/$/, "");
    return null;
  } catch {
    return null;
  }
}

/** Default fallback when no allowlisted origin (no redirect to user-controlled URL). */
export const FALLBACK_ORIGIN = "https://atlasperformancelabs.com";

/**
 * Stripe-Signature format: t=timestamp,v1=signature[,v0=...]
 * Replay safety: reject if timestamp is older than toleranceSeconds (default 5 min).
 */
export const WEBHOOK_REPLAY_TOLERANCE_SEC = 300;

export function isWebhookReplaySafe(signatureHeader: string, toleranceSec = WEBHOOK_REPLAY_TOLERANCE_SEC): boolean {
  if (!signatureHeader) return false;
  const parts = signatureHeader.split(",");
  for (const part of parts) {
    const [key, value] = part.split("=").map((s) => s.trim());
    if (key === "t" && value) {
      const ts = parseInt(value, 10);
      if (Number.isNaN(ts)) return false;
      const now = Math.floor(Date.now() / 1000);
      return Math.abs(now - ts) <= toleranceSec;
    }
  }
  return false;
}

/** Safe webhook logging: event type and non-sensitive IDs only. Never log raw body, tokens, or PII. */
export function safeLogWebhook(eventType: string, detail?: { eventId?: string; objectId?: string }) {
  const msg = detail?.eventId
    ? `[webhook] ${eventType} id=${detail.eventId}`
    : detail?.objectId
      ? `[webhook] ${eventType} object=${detail.objectId}`
      : `[webhook] ${eventType}`;
  console.log(msg);
}
