// Create/update Stripe Product + Price and store in atlas_services
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";
import { TABLE } from "../_shared/supabase.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2024-11-20.acacia" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { coach_id, service_id, name, description, price_amount, currency = "gbp", interval = "month", active = true } = body;
    const userId = body.user_id ?? coach_id;
    if (!userId) return new Response(JSON.stringify({ error: "coach_id or user_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!name || price_amount == null) return new Response(JSON.stringify({ error: "name and price_amount required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: coach } = await supabase.from(TABLE.coaches).select("id").eq("user_id", userId).single();
    if (!coach) return new Response(JSON.stringify({ error: "Coach not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const coachId = coach.id;

    const amount = Math.round(Number(price_amount));
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
        currency: (currency ?? "gbp").toLowerCase().slice(0, 3),
        unit_amount: amount,
        recurring: interval === "month" ? { interval: "month" } : undefined,
        product: product.id,
        metadata: { coach_id: coachId },
      });
      stripePriceId = price.id;
    }

    const row = {
      coach_id: coachId,
      name: name.slice(0, 500),
      description: (description ?? "").slice(0, 2000) ?? null,
      price_amount: amount,
      currency: (currency ?? "gbp").toLowerCase().slice(0, 3),
      interval: (interval ?? "month").slice(0, 20),
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
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify(inserted), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (e) {
    console.error("stripe-service-upsert", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
