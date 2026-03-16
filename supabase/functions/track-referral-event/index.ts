/**
 * Track referral events from anonymous clients (e.g. public profile page).
 * Allowed: result_story_viewed, enquiry_started.
 * Resolves coach_id from slug (referral_code) and inserts into coach_referral_events.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const ALLOWED_EVENT_TYPES = ["result_story_viewed", "enquiry_started"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
    const eventTypeRaw = typeof body?.event_type === "string" ? body.event_type.trim().toLowerCase() : "";
    const metadata = body?.metadata && typeof body.metadata === "object" ? body.metadata : {};

    if (!slug) {
      return new Response(
        JSON.stringify({ error: "slug required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!ALLOWED_EVENT_TYPES.includes(eventTypeRaw)) {
      return new Response(
        JSON.stringify({ error: "event_type must be one of: " + ALLOWED_EVENT_TYPES.join(", ") }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("track-referral-event:", err);
    return new Response(
      JSON.stringify({ error: "Request failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
