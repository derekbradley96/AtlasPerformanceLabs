// Create Stripe Checkout Session for a lead + service. Caller = coach (JWT only).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";
import { TABLE } from "../_shared/supabase.ts";
import { getAuthUserId, requireAuthResponse, jsonError } from "../_shared/auth.ts";
import { getAllowlistedRedirectOrigin, FALLBACK_ORIGIN } from "../_shared/stripe.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2024-11-20.acacia" });

function feePercentForPlan(plan_tier: string | null): number {
  const t = (plan_tier ?? "").toLowerCase();
  if (t === "elite") return 0;
  if (t === "pro") return 3;
  return 10;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const callerId = await getAuthUserId(req);
    const authErr = requireAuthResponse(callerId);
    if (authErr) return authErr;

    const body = await req.json().catch(() => ({}));
    const { service_id, lead_id, lead_name, lead_email } = body;
    if (!service_id) return jsonError("service_id required", 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: coach } = await supabase.from(TABLE.coaches).select("id, stripe_account_id, charges_enabled, plan_tier").eq("user_id", callerId).single();
    if (!coach) return new Response(JSON.stringify({ error: "Coach not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!coach.stripe_account_id) return new Response(JSON.stringify({ error: "Coach has no Stripe Connect account; connect in Earnings first" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!coach.charges_enabled) return new Response(JSON.stringify({ error: "Coach Stripe account not ready for payments" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const feePercent =
      coach.plan_tier != null
        ? feePercentForPlan(coach.plan_tier)
        : (Number(Deno.env.get("STRIPE_APPLICATION_FEE_PERCENT")) || 10); // safe fallback: missing plan_tier => 10%, no throw

    const { data: service } = await supabase.from(TABLE.services).select("id, name, stripe_price_id, price_amount, currency").eq("id", service_id).eq("coach_id", coach.id).single();
    if (!service?.stripe_price_id) return new Response(JSON.stringify({ error: "Service or Stripe price not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    let leadId = lead_id;
    const name = (lead_name ?? "").trim() || "Customer";
    const email = (lead_email ?? "").trim();
    if (!email) return new Response(JSON.stringify({ error: "lead_email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (!leadId) {
      const { data: newLead, error: leadErr } = await supabase.from(TABLE.leads).insert({ coach_id: coach.id, name, email, status: "new", source: "checkout" }).select("id").single();
      if (leadErr) return new Response(JSON.stringify({ error: leadErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      leadId = newLead.id;
    }

    const base = getAllowlistedRedirectOrigin(req) ?? FALLBACK_ORIGIN;
    const successUrl = `${base}/lead-checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${base}/lead-checkout/cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: service.stripe_price_id, quantity: 1 }],
      subscription_data: {
        application_fee_percent: feePercent,
        transfer_data: { destination: coach.stripe_account_id },
        metadata: { coach_id: coach.id, service_id: service.id, lead_id: leadId },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: email,
      client_reference_id: leadId,
      metadata: { coach_id: coach.id, service_id: service.id, lead_id: leadId },
    });

    const url = session.url ?? (session as { url?: string }).url;
    if (!url) return new Response(JSON.stringify({ error: "No checkout URL" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ url, session_id: session.id, lead_id: leadId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("stripe-checkout-session", e);
    return jsonError("Request failed", 500);
  }
});
