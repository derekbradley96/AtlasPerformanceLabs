/**
 * Cancel coach's Pro plan at period end. Caller = coach (JWT only).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";
import { TABLE } from "../_shared/supabase.ts";
import { getAuthUserId, requireAuthResponse, jsonError } from "../_shared/auth.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2024-11-20.acacia" });
const PRO_PRICE_ID = Deno.env.get("STRIPE_PRICE_PRO") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const callerId = await getAuthUserId(req);
    const authErr = requireAuthResponse(callerId);
    if (authErr) return authErr;
    const userId = callerId;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: coach, error: coachErr } = await supabase.from(TABLE.coaches).select("id, stripe_customer_id").eq("user_id", userId).single();
    if (coachErr || !coach) return new Response(JSON.stringify({ error: "Coach not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const customerId = (coach as { stripe_customer_id?: string }).stripe_customer_id;
    if (!customerId) return new Response(JSON.stringify({ error: "No subscription to cancel" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 20,
    });

    let canceled = false;
    for (const sub of subscriptions.data) {
      const priceId = sub.items?.data?.[0]?.price?.id;
      const isPro = priceId === PRO_PRICE_ID || (sub.metadata?.plan_tier === "pro");
      if (isPro) {
        await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
        canceled = true;
        break;
      }
    }

    if (!canceled) return new Response(JSON.stringify({ error: "No active Pro subscription found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("cancelProPlan", e);
    return jsonError("Request failed", 500);
  }
});
