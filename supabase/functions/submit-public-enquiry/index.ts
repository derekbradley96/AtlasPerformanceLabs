/**
 * Submit a public enquiry from the coach profile page. No auth.
 * Resolves coach_id from slug (referral_code), inserts coach_public_enquiries and coach_referral_events (enquiry_started).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkEdgeRateLimit, getClientIp, verifyTurnstileToken } from "../_shared/publicSecurity.ts";

const ENQUIRY_TYPES = ["transformation", "competition", "general"];
const enquirySchema = z.object({
  slug: z.string().trim().min(1).max(80),
  enquiry_name: z.string().trim().min(1).max(120),
  enquiry_email: z.string().trim().email().max(200),
  enquiry_goal: z.string().trim().max(500).optional().nullable(),
  enquiry_type: z.enum(["transformation", "competition", "general"]).optional().nullable(),
  message: z.string().trim().max(2000).optional().nullable(),
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
    const parsed = enquirySchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid request payload" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    const body = parsed.data;
    const slug = body.slug.trim();
    const name = body.enquiry_name.trim();
    const email = body.enquiry_email.trim();
    const goal = body.enquiry_goal?.trim() || null;
    const enquiryTypeRaw = body.enquiry_type?.trim().toLowerCase() ?? null;
    const enquiryType = enquiryTypeRaw && ENQUIRY_TYPES.includes(enquiryTypeRaw) ? enquiryTypeRaw : null;
    const message = body.message?.trim() || null;

    const rate = await checkEdgeRateLimit({
      req,
      scope: "submit-public-enquiry",
      keyPart: slug.toLowerCase(),
      maxHits: 12,
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
        JSON.stringify({ error: "Coach not found" }),
        { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const { data: enquiry, error: insertErr } = await supabase
      .from("coach_public_enquiries")
      .insert({
        coach_id: coachId,
        referral_code: referralCode,
        enquiry_name: name,
        enquiry_email: email,
        enquiry_goal: goal || null,
        enquiry_type: enquiryType,
        message: message || null,
        status: "new",
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("submit-public-enquiry insert:", insertErr);
      return new Response(
        JSON.stringify({ error: "Failed to save enquiry" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    await supabase.from("coach_referral_events").insert({
      coach_id: coachId,
      code: referralCode,
      event_type: "enquiry_started",
      metadata: { enquiry_id: (enquiry as { id: string }).id },
    });
    await supabase.from("coach_referral_events").insert({
      coach_id: coachId,
      code: referralCode,
      event_type: "enquiry_submitted",
      metadata: { enquiry_id: (enquiry as { id: string }).id },
    });

    return new Response(
      JSON.stringify({ ok: true, id: (enquiry as { id: string }).id }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("submit-public-enquiry:", err);
    return new Response(
      JSON.stringify({ error: "Request failed" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
