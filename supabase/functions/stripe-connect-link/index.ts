// Stripe Connect onboarding link: create coach/account if none, return URL. Caller = coach (JWT only).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";
import { TABLE } from "../_shared/supabase.ts";
import { getAuthUserId, requireAuthResponse, jsonError } from "../_shared/auth.ts";
import { getAllowlistedRedirectOrigin, FALLBACK_ORIGIN } from "../_shared/stripe.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2024-11-20.acacia" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const callerId = await getAuthUserId(req);
    const authErr = requireAuthResponse(callerId);
    if (authErr) return authErr;
    const userId = callerId;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const base = getAllowlistedRedirectOrigin(req) ?? FALLBACK_ORIGIN;
    const returnUrl = `${base}/earnings?stripe=return`;
    const refreshUrl = `${base}/earnings?stripe=refresh`;

    const { data: coachRow } = await supabase.from(TABLE.coaches).select("id, stripe_account_id").eq("user_id", userId).single();
    let coachId = coachRow?.id;
    let accountId = coachRow?.stripe_account_id ?? null;

    if (!coachId) {
      const { data: newCoach, error: insertErr } = await supabase.from(TABLE.coaches).insert({ user_id: userId }).select("id").single();
      if (insertErr) return jsonError("Request failed", 500);
      coachId = newCoach.id;
    }

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "GB",
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      });
      accountId = account.id;
      await supabase.from(TABLE.coaches).update({ stripe_account_id: accountId, updated_at: new Date().toISOString() }).eq("id", coachId);
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      return_url: returnUrl,
      refresh_url: refreshUrl,
    });

    return new Response(JSON.stringify({ url: accountLink.url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("stripe-connect-link", e);
    return jsonError("Request failed", 500);
  }
});
