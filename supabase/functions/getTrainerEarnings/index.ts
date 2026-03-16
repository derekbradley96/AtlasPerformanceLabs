/**
 * Coach earnings summary. Caller = coach (JWT only).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";
import { TABLE } from "../_shared/supabase.ts";
import { getAuthUserId, requireAuthResponse, jsonError } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const callerId = await getAuthUserId(req);
    const authErr = requireAuthResponse(callerId);
    if (authErr) return authErr;
    const userId = callerId;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: coach, error: coachErr } = await supabase
      .from(TABLE.coaches)
      .select("id, user_id, stripe_account_id, plan_tier, stripe_customer_id, subscription_status")
      .eq("user_id", userId)
      .maybeSingle();

    if (coachErr) {
      return new Response(JSON.stringify({ error: coachErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Active clients: public.clients where coach_id = userId (auth.uid()); trainer_id for legacy
    const { count: clientCount, error: clientErr } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .or(`coach_id.eq.${userId},trainer_id.eq.${userId}`);

    const activeClients = clientErr ? 0 : (clientCount ?? 0);

    let monthlyRevenue = 0;
    let lifetimeEarnings = 0;
    let pendingPayouts = 0;
    const currentPlan = (coach?.plan_tier ?? "basic").toLowerCase();

    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeSecret && coach?.stripe_account_id) {
      const stripe = new Stripe(stripeSecret, { apiVersion: "2024-11-20.acacia" });
      try {
        const balance = await stripe.balance.retrieve({ stripeAccount: coach.stripe_account_id });
        const available = balance.available?.[0];
        if (available) pendingPayouts = available.amount;
      } catch (e) {
        console.error("getTrainerEarnings Stripe balance:", e);
      }
      // Optional: list balance transactions for monthly/lifetime (more API calls)
      // For now leave monthlyRevenue and lifetimeEarnings at 0 or derive from client_billing if you store amounts
    }

    // Upgrade savings: 10% basic vs 3% pro — (monthlyRevenue * 0.10) - (monthlyRevenue * 0.03) when on basic
    const upgradeSavings = currentPlan !== "pro" && currentPlan !== "elite" ? Math.round(monthlyRevenue * (0.1 - 0.03)) : 0;

    return new Response(
      JSON.stringify({
        monthlyRevenue,
        lifetimeEarnings,
        pendingPayouts,
        activeClients,
        currentPlan,
        upgradeSavings,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("getTrainerEarnings", e);
    return jsonError("Request failed", 500);
  }
});
