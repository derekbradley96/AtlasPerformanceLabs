/**
 * List client profile(s) for the authenticated user only (clients where user_id = caller).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getAuthUserId, requireAuthResponse, jsonError } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const callerId = await getAuthUserId(req);
    const authErr = requireAuthResponse(callerId);
    if (authErr) return authErr;
    const userId = callerId;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: rows, error } = await supabase
      .from("clients")
      .select("id, user_id, coach_id, trainer_id, name, full_name, phase, phase_started_at, baseline_weight, gym_name, created_at, monthly_fee, next_due_date, billing_status, lifecycle_stage, membership_type")
      .eq("user_id", userId);

    if (error) {
      return jsonError("Request failed", 500);
    }
    const list = Array.isArray(rows) ? rows : [];
    // Map to legacy-friendly shape: subscription_status from billing_status
    const out = list.map((r: Record<string, unknown>) => ({
      ...r,
      subscription_status: r.billing_status ?? "active",
    }));
    return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("client-profile-list", e);
    return jsonError("Request failed", 500);
  }
});
