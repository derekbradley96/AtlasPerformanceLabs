/**
 * Track referral events from anonymous clients (e.g. public profile page).
 * Allowed: result_story_viewed, enquiry_started.
 * Resolves coach_id from slug (referral_code) and inserts into coach_referral_events.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkEdgeRateLimit, getClientIp, verifyTurnstileToken } from "../_shared/publicSecurity.ts";

const metadataSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
  .refine((value) => Object.keys(value).length <= 20, "metadata too large");
const payloadSchema = z.object({
  slug: z.string().trim().min(1).max(80),
  event_type: z.enum(["result_story_viewed", "enquiry_started"]),
  metadata: metadataSchema.optional().default({}),
  captcha_token: z.string().trim().max(4096).optional().nullable(),
}).strict();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server not configured" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawBody = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const parsed = payloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid request payload" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    const body = parsed.data;
    const slug = body.slug.trim();
    const eventTypeRaw = body.event_type.trim().toLowerCase();
    const metadata = body.metadata ?? {};

    const rate = await checkEdgeRateLimit({
      req,
      scope: "track-referral-event",
      keyPart: `${slug.toLowerCase()}:${eventTypeRaw}`,
      maxHits: 30,
      windowSeconds: 60,
    });
    if (!rate.allowed) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/json",
          "Retry-After": String(rate.retryAfterSeconds),
        },
      });
    }

    const ip = getClientIp(req);
    const captchaOk = await verifyTurnstileToken(body.captcha_token ?? "", ip);
    if (!captchaOk) {
      return new Response(JSON.stringify({ error: "Captcha verification failed" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const normalized = slug.toLowerCase();

    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, referral_code")
      .ilike("referral_code", normalized)
      .limit(1);
    let coachId: string | null = Array.isArray(profileRows) && profileRows.length > 0 ? (profileRows[0] as { id: string }).id : null;
    let referralCode: string | null = coachId && profileRows?.[0] ? (profileRows[0] as { referral_code?: string }).referral_code ?? slug : slug;

    if (!coachId) {
      const { data: codeRows } = await supabase
        .from("coach_referral_codes")
        .select("coach_id, code")
        .ilike("code", normalized)
        .eq("is_active", true)
        .limit(1);
      const row = Array.isArray(codeRows) && codeRows.length > 0 ? codeRows[0] : null;
      if (row) {
        coachId = (row as { coach_id: string }).coach_id;
        referralCode = (row as { code: string }).code;
      }
    }

    if (!coachId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Coach not found" }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const { error } = await supabase.from("coach_referral_events").insert({
      coach_id: coachId,
      code: referralCode,
      event_type: eventTypeRaw,
      metadata: metadata ?? {},
    });

    if (error) {
      console.error("track-referral-event insert:", error);
      return new Response(
        JSON.stringify({ error: "Failed to record event" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("track-referral-event:", err);
    return new Response(
      JSON.stringify({ error: "Request failed" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
