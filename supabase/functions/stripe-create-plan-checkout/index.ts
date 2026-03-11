// Create Checkout Session for trainer platform plan (Basic/Pro/Elite). Stores customer + subscription on coach.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";
import { TABLE } from "../_shared/supabase.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2024-11-20.acacia" });

const PLAN_PRICES: Record<string, string> = {
  basic: Deno.env.get("STRIPE_PRICE_BASIC") ?? "",
  pro: Deno.env.get("STRIPE_PRICE_PRO") ?? "",
  elite: Deno.env.get("STRIPE_PRICE_ELITE") ?? "",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const userId = body.user_id ?? body.coach_id;
    const planTier = (body.plan_tier ?? "pro") as string;
    if (!userId) return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const priceId = PLAN_PRICES[planTier.toLowerCase()];
    if (!priceId) return new Response(JSON.stringify({ error: "Invalid plan_tier or price not configured" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: coach, error: coachErr } = await supabase.from(TABLE.coaches).select("id, stripe_customer_id").eq("user_id", userId).single();
    if (coachErr || !coach) return new Response(JSON.stringify({ error: "Coach not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const origin = req.headers.get("Origin") ?? req.headers.get("Referer") ?? "https://atlas.app";
    const successUrl = `${origin.replace(/\/$/, "")}/plan?success=1&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin.replace(/\/$/, "")}/plan?canceled=1`;

    let customerId = coach.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { coach_id: coach.id, user_id: userId },
      });
      customerId = customer.id;
      await supabase.from(TABLE.coaches).update({
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      }).eq("id", coach.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: { coach_id: coach.id, user_id: userId, plan_tier: planTier.toLowerCase() },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { coach_id: coach.id, user_id: userId, plan_tier: planTier.toLowerCase() },
    });

    const url = session.url ?? (session as { url?: string }).url;
    if (!url) return new Response(JSON.stringify({ error: "No checkout URL" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ url, session_id: session.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("stripe-create-plan-checkout", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
