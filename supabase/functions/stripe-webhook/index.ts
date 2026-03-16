// Stripe webhook: verify signature, replay-safe, idempotent. Raw body only.
// Atlas commission from coach_subscription_tiers; fee from invoice.amount_paid (never from client).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";
import { TABLE } from "../_shared/supabase.ts";
import { isWebhookReplaySafe, safeLogWebhook } from "../_shared/stripe.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2024-11-20.acacia" });
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

/** Atlas commission by tier (default when no row in coach_subscription_tiers is basic 10%). Server-side only. */
const TIER_COMMISSION = { basic: 0.1, pro: 0.03, elite: 0 } as const;

function calculatePlatformFee(amountPaidCents: number, commissionRate: number): { platformFeeCents: number; coachAmountCents: number } {
  const rate = Number(commissionRate);
  const safeRate = Number.isNaN(rate) || rate < 0 ? 0 : Math.min(1, rate);
  const platformFeeCents = Math.round(amountPaidCents * safeRate);
  const coachAmountCents = amountPaidCents - platformFeeCents;
  return { platformFeeCents, coachAmountCents };
}

function jsonResp(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const raw = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig || !webhookSecret) return jsonResp({ error: "Missing signature or webhook secret" }, 400);

  if (!isWebhookReplaySafe(sig)) {
    safeLogWebhook("reject_replay", { objectId: "timestamp_outside_tolerance" });
    return jsonResp({ error: "Replay or expired" }, 400);
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, webhookSecret);
  } catch {
    safeLogWebhook("signature_invalid");
    return jsonResp({ error: "Invalid signature" }, 400);
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const now = new Date().toISOString();

  const { error: insertErr } = await supabase.from("stripe_webhook_events").insert({
    event_id: event.id,
    event_type: event.type,
    processed_at: now,
  });
  if (insertErr) {
    if (insertErr.code === "23505") return jsonResp({ received: true }, 200);
    safeLogWebhook("idempotency_insert_failed", { eventId: event.id });
    return jsonResp({ error: "Webhook processing failed" }, 500);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const coachId = session.metadata?.coach_id ?? null;
        const leadId = session.metadata?.lead_id ?? session.client_reference_id ?? null;
        const planTier = session.metadata?.plan_tier ?? null;
        const serviceId = session.metadata?.service_id ?? null;

        if (!coachId) break;

        if (planTier && !leadId) {
          const subId = session.subscription as string;
          let currentPeriodEnd: string | null = null;
          if (subId) {
            try {
              const sub = await stripe.subscriptions.retrieve(subId);
              currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
            } catch (_) {}
          }
          await supabase.from(TABLE.coaches).update({
            stripe_customer_id: (session.customer as string) ?? null,
            subscription_status: "active",
            plan_tier: (planTier as string).toLowerCase(),
            current_period_end: currentPeriodEnd,
            updated_at: now,
          }).eq("id", coachId);
          safeLogWebhook("checkout.session.completed", { objectId: session.id });
          break;
        }

        if (!leadId) break;
        const { data: lead } = await supabase.from(TABLE.leads).select("id, name, email").eq("id", leadId).single();
        if (!lead) break;
        await supabase.from(TABLE.leads).update({ status: "paid", updated_at: now }).eq("id", leadId);
        let clientId: string | null = null;
        const { data: existingClient } = await supabase.from(TABLE.clients).select("id").eq("coach_id", coachId).eq("email", lead.email ?? "").single();
        if (existingClient) {
          clientId = existingClient.id;
        } else {
          const { data: newClient } = await supabase.from(TABLE.clients).insert({
            coach_id: coachId,
            name: lead.name ?? lead.email ?? "Client",
            email: lead.email ?? null,
            status: "active",
            created_at: now,
            updated_at: now,
          }).select("id").single();
          clientId = newClient?.id ?? null;
        }
        await supabase.from(TABLE.payments).insert({
          coach_id: coachId,
          client_id: clientId,
          lead_id: leadId,
          stripe_customer_id: session.customer as string ?? null,
          stripe_subscription_id: session.subscription as string ?? null,
          status: "active",
          last_invoice_status: "paid",
          created_at: now,
          updated_at: now,
        });
        const dedupeKey = `intake_required:${coachId}:${clientId}`;
        await supabase.from(TABLE.review_items).upsert({
          coach_id: coachId,
          client_id: clientId,
          type: "intake_required",
          status: "active",
          priority: 50,
          dedupe_key: dedupeKey,
          metadata_json: { lead_id: leadId, service_id: serviceId ?? null },
          created_at: now,
          updated_at: now,
        }, { onConflict: "coach_id,dedupe_key" });
        safeLogWebhook("checkout.session.completed", { objectId: session.id });
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoice.subscription as string;
        if (!subId) break;
        const amountPaidCents = invoice.amount_paid ?? 0;
        const { data: pay } = await supabase.from(TABLE.payments).select("coach_id, client_id").eq("stripe_subscription_id", subId).single();
        let commissionRate = TIER_COMMISSION.basic;
        if (pay?.coach_id) {
          const { data: coach } = await supabase.from(TABLE.coaches).select("user_id").eq("id", pay.coach_id).single();
          const profileId = coach?.user_id ?? null;
          if (profileId) {
            const { data: tier } = await supabase.from(TABLE.coach_subscription_tiers).select("commission_rate").eq("coach_id", profileId).single();
            if (tier != null && typeof tier.commission_rate === "number" && !Number.isNaN(tier.commission_rate)) {
              commissionRate = Math.min(1, Math.max(0, tier.commission_rate));
            }
          }
          const { platformFeeCents, coachAmountCents } = calculatePlatformFee(amountPaidCents, commissionRate);
          await supabase.from(TABLE.invoice_fees).upsert({
            stripe_invoice_id: invoice.id,
            stripe_subscription_id: subId,
            coach_id: pay.coach_id,
            amount_paid_cents: amountPaidCents,
            platform_fee_cents: platformFeeCents,
            coach_amount_cents: coachAmountCents,
            commission_rate: commissionRate,
            created_at: now,
          }, { onConflict: "stripe_invoice_id" });
        }
        await supabase.from(TABLE.payments).update({
          status: "active",
          last_invoice_status: "paid",
          current_period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
          updated_at: now,
        }).eq("stripe_subscription_id", subId);
        if (pay?.client_id) {
          await supabase.from(TABLE.review_items).update({ status: "done", updated_at: now }).eq("coach_id", pay.coach_id).eq("client_id", pay.client_id).eq("type", "payment_overdue");
        }
        safeLogWebhook("invoice.paid", { objectId: invoice.id });
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoice.subscription as string;
        if (!subId) break;
        await supabase.from(TABLE.payments).update({
          status: "past_due",
          last_invoice_status: "open",
          updated_at: now,
        }).eq("stripe_subscription_id", subId);
        const { data: pay } = await supabase.from(TABLE.payments).select("coach_id, client_id").eq("stripe_subscription_id", subId).single();
        if (pay?.client_id) {
          const dedupeKey = `payment_overdue:${pay.coach_id}:${pay.client_id}`;
          await supabase.from(TABLE.review_items).upsert({
            coach_id: pay.coach_id,
            client_id: pay.client_id,
            type: "payment_overdue",
            status: "active",
            priority: 80,
            dedupe_key: dedupeKey,
            metadata_json: {},
            created_at: now,
            updated_at: now,
          }, { onConflict: "coach_id,dedupe_key" });
        }
        safeLogWebhook("invoice.payment_failed", { objectId: invoice.id });
        break;
      }
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const { data: coach } = await supabase.from(TABLE.coaches).select("id").eq("stripe_account_id", account.id).single();
        if (coach) {
          await supabase.from(TABLE.coaches).update({
            charges_enabled: account.charges_enabled ?? false,
            payouts_enabled: account.payouts_enabled ?? false,
            updated_at: now,
          }).eq("id", coach.id);
        }
        safeLogWebhook("account.updated", { objectId: account.id });
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const status = sub.status === "active" || sub.status === "trialing" ? "active" : sub.status === "past_due" ? "past_due" : "canceled";
        const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
        const planTier = sub.metadata?.plan_tier ?? null;
        const coachIdSub = sub.metadata?.coach_id ?? null;
        if (planTier && coachIdSub) {
          await supabase.from(TABLE.coaches).update({
            subscription_status: status,
            plan_tier: (planTier as string).toLowerCase(),
            current_period_end: periodEnd,
            updated_at: now,
          }).eq("id", coachIdSub);
        }
        await supabase.from(TABLE.payments).update({
          status,
          current_period_end: periodEnd,
          updated_at: now,
        }).eq("stripe_subscription_id", sub.id);
        safeLogWebhook(event.type, { objectId: sub.id });
        break;
      }
      default:
        safeLogWebhook(event.type, { eventId: event.id });
    }
  } catch (e) {
    safeLogWebhook("handler_error", { eventId: event.id });
    return jsonResp({ error: "Webhook processing failed" }, 500);
  }

  return jsonResp({ received: true }, 200);
});
