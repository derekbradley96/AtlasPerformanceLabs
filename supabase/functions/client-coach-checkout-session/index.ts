/**
 * Authenticated client with billing_status pending_payment: Stripe Checkout for coach's atlas_services package.
 * Does not use coach JWT — server validates clients.user_id === caller.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { getCorsHeaders } from "../_shared/cors.ts";
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
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  try {
    const callerId = await getAuthUserId(req);
    const authErr = requireAuthResponse(callerId);
    if (authErr) return authErr;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: clRow, error: cErr } = await supabase
      .from("clients")
      .select("id, coach_id, trainer_id, billing_status, selected_service_id")
      .eq("user_id", callerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cErr || !clRow?.id) return jsonError("Client record not found", 404);

    const billing = String((clRow as { billing_status?: string }).billing_status ?? "");
    if (billing !== "pending_payment") {
      return new Response(JSON.stringify({ error: "No pending coach offer payment for this account" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const serviceId = (clRow as { selected_service_id?: string | null }).selected_service_id;
    if (!serviceId) return jsonError("No package selected", 400);

    const coachProfileId = (clRow as { coach_id?: string }).coach_id ?? (clRow as { trainer_id?: string }).trainer_id;
    if (!coachProfileId) return jsonError("Coach not linked", 400);

    const { data: atlasCoach, error: acErr } = await supabase
      .from(TABLE.coaches)
      .select("id, stripe_account_id, charges_enabled, plan_tier")
      .eq("user_id", coachProfileId)
      .maybeSingle();

    if (acErr || !atlasCoach?.id) return jsonError("Coach billing is not set up yet", 400);
    const coach = atlasCoach as {
      id: string;
      stripe_account_id: string | null;
      charges_enabled: boolean | null;
      plan_tier: string | null;
    };
    if (!coach.stripe_account_id) {
      return jsonError("Coach has not connected Stripe yet. Contact your coach.", 400);
    }
    if (!coach.charges_enabled) {
      return jsonError("Coach payments are not ready yet. Contact your coach.", 400);
    }

    const { data: service, error: sErr } = await supabase
      .from(TABLE.services)
      .select("id, name, stripe_price_id, price_amount, currency, coach_id")
      .eq("id", serviceId)
      .eq("coach_id", coach.id)
      .maybeSingle();

    if (sErr || !service?.stripe_price_id) {
      return jsonError("Package is not available for online payment", 400);
    }

    const feePercent =
      coach.plan_tier != null
        ? feePercentForPlan(coach.plan_tier)
        : (Number(Deno.env.get("STRIPE_APPLICATION_FEE_PERCENT")) || 10);

    const base = getAllowlistedRedirectOrigin(req) ?? FALLBACK_ORIGIN;
    const successUrl = `${base}/client-onboarding-flow?coach_offer_paid=1&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${base}/client-onboarding-flow?coach_offer_paid=cancel`;

    let custEmail: string | undefined;
    try {
      const { data: au } = await supabase.auth.admin.getUserById(callerId);
      const e = au?.user?.email;
      if (typeof e === "string" && e.trim()) custEmail = e.trim();
    } catch (_) {}

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: service.stripe_price_id as string, quantity: 1 }],
      subscription_data: {
        application_fee_percent: feePercent,
        transfer_data: { destination: coach.stripe_account_id },
        metadata: {
          coach_id: coach.id,
          service_id: service.id as string,
          client_offer: "1",
          clients_row_id: clRow.id as string,
          client_user_id: callerId,
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...(custEmail ? { customer_email: custEmail } : {}),
      client_reference_id: clRow.id as string,
      metadata: {
        coach_id: coach.id,
        service_id: service.id as string,
        client_offer: "1",
        clients_row_id: clRow.id as string,
        client_user_id: callerId,
      },
    });

    const url = session.url ?? null;
    if (!url) return jsonError("No checkout URL", 500);
    return new Response(JSON.stringify({ url, session_id: session.id }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("client-coach-checkout-session", e);
    return jsonError("Request failed", 500);
  }
});
