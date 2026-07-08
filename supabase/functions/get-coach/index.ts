// Return coach row for the authenticated user only (JWT).
// Pass { sync: true } to refresh charges/payouts flags live from Stripe —
// used right after Connect onboarding returns, before the account.updated
// webhook has landed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { getCorsHeaders } from "../_shared/cors.ts";
import { TABLE } from "../_shared/supabase.ts";
import { getAuthUserId, requireAuthResponse, jsonError } from "../_shared/auth.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2024-11-20.acacia" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  try {
    const callerId = await getAuthUserId(req);
    const authErr = requireAuthResponse(callerId);
    if (authErr) return authErr;

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let { data: coach, error } = await supabase.from(TABLE.coaches).select("id, user_id, stripe_account_id, charges_enabled, payouts_enabled, plan_tier, timezone, stripe_customer_id, subscription_status, current_period_end").eq("user_id", callerId).single();

    if (error && error.code !== "PGRST116") return jsonError("Request failed", 500);

    if (body?.sync === true && coach?.stripe_account_id) {
      try {
        const account = await stripe.accounts.retrieve(coach.stripe_account_id as string);
        const chargesEnabled = account.charges_enabled ?? false;
        const payoutsEnabled = account.payouts_enabled ?? false;
        if (chargesEnabled !== coach.charges_enabled || payoutsEnabled !== coach.payouts_enabled) {
          await supabase
            .from(TABLE.coaches)
            .update({ charges_enabled: chargesEnabled, payouts_enabled: payoutsEnabled, updated_at: new Date().toISOString() })
            .eq("id", coach.id);
        }
        coach = { ...coach, charges_enabled: chargesEnabled, payouts_enabled: payoutsEnabled };
      } catch (_) {
        // Stripe hiccup — fall back to DB values; the webhook will catch up.
      }
    }
    const { data: billingState } = await supabase
      .from("coach_billing_state")
      .select("plan_tier,subscription_status,current_period_end,monthly_revenue_estimate,monthly_fees_estimate,recommended_plan,last_upgrade_prompt_at,upgrade_prompt_cooldown_until")
      .eq("coach_id", callerId)
      .maybeSingle();
    const connected = !!(coach?.stripe_account_id);
    return new Response(JSON.stringify({ coach: coach ?? null, billing_state: billingState ?? null, connected, charges_enabled: coach?.charges_enabled ?? false, payouts_enabled: coach?.payouts_enabled ?? false }), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  } catch (e) {
    console.error("get-coach", e);
    return jsonError("Request failed", 500);
  }
});
