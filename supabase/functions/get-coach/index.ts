// Return coach row for current user (for Stripe status, etc.)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { TABLE } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const userId = body.user_id ?? body.coach_id ?? req.headers.get("X-User-Id");
    if (!userId) return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: coach, error } = await supabase.from(TABLE.coaches).select("id, user_id, stripe_account_id, charges_enabled, payouts_enabled, plan_tier, timezone, stripe_customer_id, subscription_status, current_period_end").eq("user_id", userId).single();

    if (error && error.code !== "PGRST116") return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const connected = !!(coach?.stripe_account_id);
    return new Response(JSON.stringify({ coach: coach ?? null, connected, charges_enabled: coach?.charges_enabled ?? false, payouts_enabled: coach?.payouts_enabled ?? false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("get-coach", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
