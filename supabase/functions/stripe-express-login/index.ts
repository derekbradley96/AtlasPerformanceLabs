// Stripe Express dashboard login link for the authenticated coach (JWT only).
// Coaches manage payouts, bank details and see transfer history there —
// the app itself never had payout visibility before this.
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

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: coach } = await supabase
      .from(TABLE.coaches)
      .select("id, stripe_account_id")
      .eq("user_id", callerId)
      .single();

    if (!coach?.stripe_account_id) {
      return jsonError("No connected Stripe account", 404);
    }

    const loginLink = await stripe.accounts.createLoginLink(coach.stripe_account_id as string);
    return new Response(JSON.stringify({ url: loginLink.url }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("stripe-express-login", e);
    return jsonError("Request failed", 500);
  }
});
