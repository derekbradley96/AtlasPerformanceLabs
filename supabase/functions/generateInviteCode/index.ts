/**
 * Get or ensure the authenticated coach has a referral code. User id is derived from JWT only.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getAuthUserId, requireAuthResponse, jsonError } from "../_shared/auth.ts";

function randomCode() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return "atlas-" + s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const callerId = await getAuthUserId(req);
    const authErr = requireAuthResponse(callerId);
    if (authErr) return authErr;
    const userId = callerId;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonError("Server not configured", 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, referral_code")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const existing = (profile as { referral_code?: string }).referral_code?.trim();
    if (existing) {
      return new Response(JSON.stringify({ code: existing }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let code: string | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const c = randomCode();
      const { data: conflict } = await supabase.from("profiles").select("id").eq("referral_code", c).maybeSingle();
      if (!conflict) {
        const { error: updateErr } = await supabase.from("profiles").update({ referral_code: c }).eq("id", userId);
        if (!updateErr) {
          code = c;
          break;
        }
      }
    }
    if (!code) {
      return new Response(JSON.stringify({ error: "Failed to generate unique code" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ code }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("generateInviteCode:", err);
    return jsonError("Request failed", 500);
  }
});
