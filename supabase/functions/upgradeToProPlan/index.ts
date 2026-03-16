/**
 * Create Checkout Session for Pro plan. Caller = coach (user id from JWT only).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";
import { TABLE } from "../_shared/supabase.ts";
import { getAuthUserId, requireAuthResponse, jsonError } from "../_shared/auth.ts";
import { getAllowlistedRedirectOrigin, FALLBACK_ORIGIN } from "../_shared/stripe.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2024-11-20.acacia" });
const PRO_PRICE_ID = Deno.env.get("STRIPE_PRICE_PRO") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const callerId = await getAuthUserId(req);
    const authErr = requireAuthResponse(callerId);
    if (authErr) return authErr;
    const userId = callerId;

    if (!PRO_PRICE_ID) return jsonError("STRIPE_PRICE_PRO not configured", 500);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: coach, error: coachErr } = await supabase.from(TABLE.coaches).select("id, stripe_customer_id").eq("user_id", userId).single();
    if (coachErr || !coach) return new Response(JSON.stringify({ error: "Coach not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const base = getAllowlistedRedirectOrigin(req) ?? FALLBACK_ORIGIN;
    const successUrl = `${base}/plan?success=1&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${base}/plan?canceled=1`;

    let customerId = (coach as { stripe_customer_id?: string }).stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { coach_id: coach.id, user_id: userId },
      });
      customerId = customer.id;
      await supabase.from(TABLE.coaches).update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() }).eq("id", coach.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: customerId,
      line_items: [{ price: PRO_PRICE_ID, quantity: 1 }],
      subscription_data: {
        metadata: { coach_id: coach.id, user_id: userId, plan_tier: "pro" },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { coach_id: coach.id, user_id: userId, plan_tier: "pro" },
    });

    const url = session.url ?? (session as { url?: string }).url ?? null;
    if (!url) return new Response(JSON.stringify({ error: "No checkout URL" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ url, sessionUrl: url, session_id: session.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("upgradeToProPlan", e);
    return jsonError("Request failed", 500);
  }
});
