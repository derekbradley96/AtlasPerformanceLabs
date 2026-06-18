import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

export async function verifyTurnstileToken(token: string, ip: string): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) return true; // Optional: enforce only when configured.
  if (!token) return false;

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (ip && ip !== "unknown") form.set("remoteip", ip);

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
    });
    if (!res.ok) return false;
    const payload = await res.json().catch(() => ({}));
    return payload?.success === true;
  } catch {
    return false;
  }
}

export async function checkEdgeRateLimit(params: {
  req: Request;
  scope: string;
  keyPart: string;
  maxHits: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) return { allowed: true, retryAfterSeconds: 0 };

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const ip = getClientIp(params.req);
  const key = `${params.scope}:${params.keyPart}:${ip}`;
  const now = new Date();

  const { data: row } = await supabase
    .from("edge_rate_limits")
    .select("key, window_started_at, hit_count")
    .eq("key", key)
    .maybeSingle();

  if (!row) {
    await supabase.from("edge_rate_limits").upsert({
      key,
      scope: params.scope,
      ip,
      key_part: params.keyPart,
      window_started_at: now.toISOString(),
      hit_count: 1,
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const startedAt = new Date((row as { window_started_at: string }).window_started_at);
  const elapsedSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  if (elapsedSeconds >= params.windowSeconds) {
    await supabase.from("edge_rate_limits").update({
      window_started_at: now.toISOString(),
      hit_count: 1,
      updated_at: now.toISOString(),
    }).eq("key", key);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const hitCount = Number((row as { hit_count: number }).hit_count ?? 0);
  if (hitCount >= params.maxHits) {
    return { allowed: false, retryAfterSeconds: Math.max(1, params.windowSeconds - elapsedSeconds) };
  }

  await supabase.from("edge_rate_limits").update({
    hit_count: hitCount + 1,
    updated_at: now.toISOString(),
  }).eq("key", key);

  return { allowed: true, retryAfterSeconds: 0 };
}
