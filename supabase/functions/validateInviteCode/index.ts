/**
 * Validate coach invite code. Uses Supabase profiles.referral_code.
 * Comparison is case-insensitive: input is trimmed and lowercased before lookup.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function normalizeCode(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  return s.trim().toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Server not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const normalized = normalizeCode(body?.code);
    if (!normalized) {
      return new Response(JSON.stringify({ valid: false, error: "Invalid code" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: rows, error } = await supabase
      .from("profiles")
      .select("id, display_name, role, stripe_account_id")
      .eq("referral_code", normalized);

    if (error) {
      console.error("validateInviteCode error:", error);
      return new Response(JSON.stringify({ valid: false, error: "Lookup failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const profile = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!profile) {
      return new Response(JSON.stringify({ valid: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const isCoach = (profile as { role?: string }).role === "coach" || (profile as { role?: string }).role === "trainer";
    if (!isCoach) {
      return new Response(JSON.stringify({ valid: false, error: "Code is not for a coach" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      valid: true,
      trainer_id: (profile as { id: string }).id,
      coach_id: (profile as { id: string }).id,
      trainer: {
        id: (profile as { id: string }).id,
        name: (profile as { display_name?: string }).display_name ?? "Coach",
        niche: "",
        monthlyRate: 10000,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("validateInviteCode:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
