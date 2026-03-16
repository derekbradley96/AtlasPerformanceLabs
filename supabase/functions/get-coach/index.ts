// Return coach row for the authenticated user only (JWT).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { TABLE } from "../_shared/supabase.ts";
import { getAuthUserId, requireAuthResponse, jsonError } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const callerId = await getAuthUserId(req);
    const authErr = requireAuthResponse(callerId);
    if (authErr) return authErr;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: coach, error } = await supabase.from(TABLE.coaches).select("id, user_id, stripe_account_id, charges_enabled, payouts_enabled, plan_tier, timezone, stripe_customer_id, subscription_status, current_period_end").eq("user_id", callerId).single();

    if (error && error.code !== "PGRST116") return jsonError("Request failed", 500);
    const connected = !!(coach?.stripe_account_id);
    return new Response(JSON.stringify({ coach: coach ?? null, connected, charges_enabled: coach?.charges_enabled ?? false, payouts_enabled: coach?.payouts_enabled ?? false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("get-coach", e);
    return jsonError("Request failed", 500);
  }
});
