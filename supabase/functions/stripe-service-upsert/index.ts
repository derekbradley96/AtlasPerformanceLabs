// Create/update Stripe Product + Price and store in atlas_services. Caller = coach (JWT only).
// Price and fee are server-resolved only; never trust client-supplied amounts for billing.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";
import { TABLE } from "../_shared/supabase.ts";
import { getAuthUserId, requireAuthResponse, jsonError } from "../_shared/auth.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2024-11-20.acacia" });

const MIN_PRICE_CENTS = 50;
const MAX_PRICE_CENTS = 999_999_99;
const ALLOWED_CURRENCIES = ["gbp", "usd", "eur"];
const ALLOWED_INTERVALS = ["month", "year"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const callerId = await getAuthUserId(req);
    const authErr = requireAuthResponse(callerId);
    if (authErr) return authErr;

    const body = await req.json().catch(() => ({}));
    const { service_id, name, description, price_amount, currency = "gbp", interval = "month", active = true } = body;
    if (!name || typeof name !== "string" || name.trim().length === 0) return jsonError("name required", 400);
    const rawAmount = Number(price_amount);
    if (Number.isNaN(rawAmount)) return jsonError("price_amount required", 400);
    const amount = Math.round(rawAmount);
    if (amount < MIN_PRICE_CENTS || amount > MAX_PRICE_CENTS) return jsonError("price_amount out of range", 400);
    const curr = (typeof currency === "string" ? currency.toLowerCase().slice(0, 3) : "gbp");
    if (!ALLOWED_CURRENCIES.includes(curr)) return jsonError("currency not allowed", 400);
    const intv = (typeof interval === "string" ? interval.toLowerCase() : "month");
    if (!ALLOWED_INTERVALS.includes(intv)) return jsonError("interval not allowed", 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: coach } = await supabase.from(TABLE.coaches).select("id").eq("user_id", callerId).single();
    if (!coach) return new Response(JSON.stringify({ error: "Coach not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const coachId = coach.id;
    const now = new Date().toISOString();

    let serviceRow: { id: string; stripe_price_id: string | null } | null = null;
    if (service_id) {
      const { data } = await supabase.from(TABLE.services).select("id, stripe_price_id").eq("id", service_id).eq("coach_id", coachId).single();
      serviceRow = data;
    }

    let stripePriceId: string | null = serviceRow?.stripe_price_id ?? null;
    const productIdMeta = `coach_${coachId}`;

    if (stripePriceId) {
      try {
        await stripe.prices.update(stripePriceId, { active: !!active });
      } catch (_) {}
    } else {
      const product = await stripe.products.create({
        name: name.slice(0, 250),
        description: (description ?? "").slice(0, 500) || undefined,
        metadata: { coach_id: coachId, product_id_meta: productIdMeta },
      });
      const price = await stripe.prices.create({
        currency: curr,
        unit_amount: amount,
        recurring: intv === "month" ? { interval: "month" } : { interval: "year" },
        product: product.id,
        metadata: { coach_id: coachId },
      });
      stripePriceId = price.id;
    }

    const row = {
      coach_id: coachId,
      name: name.trim().slice(0, 500),
      description: (typeof description === "string" ? description : "").trim().slice(0, 2000) || null,
      price_amount: amount,
      currency: curr,
      interval: intv,
      stripe_price_id: stripePriceId,
      active: !!active,
      updated_at: now,
    };

    if (serviceRow?.id) {
      await supabase.from(TABLE.services).update(row).eq("id", serviceRow.id);
      const { data: updated } = await supabase.from(TABLE.services).select("*").eq("id", serviceRow.id).single();
      return new Response(JSON.stringify(updated), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else {
      const { data: inserted, error } = await supabase.from(TABLE.services).insert({ ...row, created_at: now }).select("*").single();
      if (error) return jsonError("Request failed", 500);
      return new Response(JSON.stringify(inserted), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (e) {
    console.error("stripe-service-upsert", e);
    return jsonError("Request failed", 500);
  }
});
