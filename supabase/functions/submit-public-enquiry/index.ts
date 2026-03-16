/**
 * Submit a public enquiry from the coach profile page. No auth.
 * Resolves coach_id from slug (referral_code), inserts coach_public_enquiries and coach_referral_events (enquiry_started).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const ENQUIRY_TYPES = ["transformation", "competition", "general"];

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
    const name = typeof body?.enquiry_name === "string" ? body.enquiry_name.trim() : "";
    const email = typeof body?.enquiry_email === "string" ? body.enquiry_email.trim() : "";
    const goal = typeof body?.enquiry_goal === "string" ? body.enquiry_goal.trim() : null;
    const enquiryTypeRaw = typeof body?.enquiry_type === "string" ? body.enquiry_type.trim().toLowerCase() : null;
    const enquiryType = enquiryTypeRaw && ENQUIRY_TYPES.includes(enquiryTypeRaw) ? enquiryTypeRaw : null;
    const message = typeof body?.message === "string" ? body.message.trim() : null;

    if (!slug) {
      return new Response(
        JSON.stringify({ error: "slug required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!name || !email) {
      return new Response(
        JSON.stringify({ error: "enquiry_name and enquiry_email required" }),
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
        JSON.stringify({ error: "Coach not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("submit-public-enquiry:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
