// Stripe Connect onboarding link: create coach/account if none, return URL
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";
import { TABLE } from "../_shared/supabase.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2024-11-20.acacia" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json() : {};
    const userId = body.user_id ?? body.coach_id ?? req.headers.get("X-User-Id");
    if (!userId) return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const origin = req.headers.get("Origin") ?? req.headers.get("Referer") ?? "https://atlas.app";
    const returnUrl = `${origin.replace(/\/$/, "")}/earnings?stripe=return`;
    const refreshUrl = `${origin.replace(/\/$/, "")}/earnings?stripe=refresh`;

    const { data: coachRow } = await supabase.from(TABLE.coaches).select("id, stripe_account_id").eq("user_id", userId).single();
    let coachId = coachRow?.id;
    let accountId = coachRow?.stripe_account_id ?? null;

    if (!coachId) {
      const { data: newCoach, error: insertErr } = await supabase.from(TABLE.coaches).insert({ user_id: userId }).select("id").single();
      if (insertErr) return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
