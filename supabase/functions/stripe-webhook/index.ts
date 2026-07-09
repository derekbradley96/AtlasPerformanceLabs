// Stripe webhook: verify signature, replay-safe, idempotent. Raw body only.
// Atlas commission from coach_subscription_tiers; fee from invoice.amount_paid (never from client).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { getCorsHeaders } from "../_shared/cors.ts";
import { TABLE } from "../_shared/supabase.ts";
import { isWebhookReplaySafe, safeLogWebhook } from "../_shared/stripe.ts";
import {
  ATLAS_PLAN_COMMISSION,
  computeEffectiveMonthlyCosts,
  computeMonthlyVolumeEstimate,
  computeRecommendedPlan,
  toAtlasPlanTier,
} from "../_shared/billing.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2024-11-20.acacia" });
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

/** Atlas commission by tier (default when no row in coach_subscription_tiers is basic 10%). Server-side only. */
const TIER_COMMISSION = ATLAS_PLAN_COMMISSION;

function calculatePlatformFee(amountPaidCents: number, commissionRate: number): { platformFeeCents: number; coachAmountCents: number } {
  const rate = Number(commissionRate);
  const safeRate = Number.isNaN(rate) || rate < 0 ? 0 : Math.min(1, rate);
  const platformFeeCents = Math.round(amountPaidCents * safeRate);
  const coachAmountCents = amountPaidCents - platformFeeCents;
  return { platformFeeCents, coachAmountCents };
}

// Server-to-server (Stripe) — no CORS needed; referencing request-scoped CORS here crashed every response path.
function jsonResp(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * payment_succeeded analytics (audit #22: first-payment funnel). Attributed to
 * the paying client's auth user (falls back to the coach when the client has
 * no account). Called only where a client_payments row transitions to paid,
 * so invoice.paid + invoice.payment_succeeded double-delivery can't double-track.
 * Best-effort: analytics must never fail the webhook.
 */
async function recordPaymentAnalytics(
  supabase: ReturnType<typeof createClient>,
  {
    clientRowId,
    coachProfileId,
    amountCents,
    currency,
    invoiceId,
  }: {
    clientRowId: string;
    coachProfileId: string | null;
    amountCents: number;
    currency: string;
    invoiceId: string;
  },
): Promise<void> {
  try {
    const { data: clientRow } = await supabase
      .from("clients")
      .select("user_id")
      .eq("id", clientRowId)
      .maybeSingle();
    const subjectId = (clientRow?.user_id as string | null) ?? coachProfileId;
    if (!subjectId) return;

    const { data: prof } = await supabase
      .from("profiles")
      .select("analytics_opt_out")
      .eq("id", subjectId)
      .maybeSingle();
    if (prof?.analytics_opt_out) return;

    // NULL-safe exclusion of this invoice's own row: plain .neq() would also
    // drop manual payments whose provider_payment_id is NULL.
    const { count } = await supabase
      .from("client_payments")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientRowId)
      .eq("status", "paid")
      .or(`provider_payment_id.is.null,provider_payment_id.neq.${invoiceId}`);

    await supabase.from("platform_usage_events").insert({
      event_name: "payment_succeeded",
      user_id: subjectId,
      properties: {
        client_id: clientRowId,
        coach_id: coachProfileId,
        amount: amountCents / 100,
        currency,
        invoice_id: invoiceId,
        first_payment: (count ?? 0) === 0,
        source: "stripe_webhook",
      },
    });
  } catch (err) {
    console.error("stripe-webhook payment analytics failed", invoiceId, err);
  }
}

async function resolveCoachProfileId(
  supabase: ReturnType<typeof createClient>,
  {
    coachId,
    stripeCustomerId,
    stripeSubscriptionId,
  }: { coachId?: string | null; stripeCustomerId?: string | null; stripeSubscriptionId?: string | null },
): Promise<string | null> {
  if (coachId) {
    const { data } = await supabase.from(TABLE.coaches).select("user_id").eq("id", coachId).single();
    if (data?.user_id) return data.user_id as string;
  }
  if (stripeCustomerId) {
    const { data } = await supabase.from(TABLE.coaches).select("user_id").eq("stripe_customer_id", stripeCustomerId).single();
    if (data?.user_id) return data.user_id as string;
  }
  if (stripeSubscriptionId) {
    const { data: payment } = await supabase
      .from(TABLE.payments)
      .select("coach_id")
      .eq("stripe_subscription_id", stripeSubscriptionId)
      .single();
    if (payment?.coach_id) {
      const { data: coach } = await supabase.from(TABLE.coaches).select("user_id").eq("id", payment.coach_id).single();
      if (coach?.user_id) return coach.user_id as string;
    }
  }
  return null;
}

async function computeMonthlyRevenueEstimate(
  supabase: ReturnType<typeof createClient>,
  profileId: string,
): Promise<number> {
  const { data: summary } = await supabase
    .from("v_coach_revenue_summary")
    .select("revenue_last_30d")
    .eq("coach_id", profileId)
    .maybeSingle();
  return computeMonthlyVolumeEstimate(summary?.revenue_last_30d);
}

async function syncCoachBillingState(
  supabase: ReturnType<typeof createClient>,
  {
    coachProfileId,
    planTier,
    subscriptionStatus,
    stripeCustomerId,
    stripeSubscriptionId,
    currentPeriodEnd,
    now,
  }: {
    coachProfileId: string;
    planTier?: string | null;
    subscriptionStatus?: string | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    currentPeriodEnd?: string | null;
    now: string;
  },
) {
  const monthlyRevenueEstimate = await computeMonthlyRevenueEstimate(supabase, coachProfileId);
  const effectivePlan = toAtlasPlanTier(planTier);
  const costs = computeEffectiveMonthlyCosts(monthlyRevenueEstimate);
  const monthlyFeesEstimate = costs[effectivePlan];
  const recommendation = computeRecommendedPlan(monthlyRevenueEstimate);

  await supabase.from("coach_billing_state").upsert({
    coach_id: coachProfileId,
    stripe_customer_id: stripeCustomerId ?? null,
    stripe_subscription_id: stripeSubscriptionId ?? null,
    plan_tier: effectivePlan,
    subscription_status: String(subscriptionStatus || "inactive"),
    current_period_end: currentPeriodEnd ?? null,
    monthly_revenue_estimate: monthlyRevenueEstimate,
    monthly_fees_estimate: monthlyFeesEstimate,
    recommended_plan: recommendation,
    updated_at: now,
  }, { onConflict: "coach_id" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

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
        const clientOffer = session.metadata?.client_offer === "1";
        const publicClientsRowId = session.metadata?.clients_row_id ?? null;
        if (clientOffer && publicClientsRowId) {
          await supabase.from("clients").update({ billing_status: "active" }).eq("id", publicClientsRowId);
          const clientUserId = session.metadata?.client_user_id ?? null;
          if (clientUserId && typeof clientUserId === "string") {
            await supabase.from("profiles").update({ onboarding_complete: true }).eq("id", clientUserId);
          }
          // Record the subscription link — without this row, invoice.paid can never resolve
          // which coach/client an invoice belongs to, so commission records and the coach's
          // Earnings numbers silently stay empty for the primary client-pays-coach flow.
          const offerCoachId = session.metadata?.coach_id ?? null;
          const offerSubId = (session.subscription as string) ?? null;
          if (offerCoachId && offerSubId) {
            const { data: existingPay } = await supabase
              .from(TABLE.payments)
              .select("id")
              .eq("stripe_subscription_id", offerSubId)
              .maybeSingle();
            if (!existingPay?.id) {
              await supabase.from(TABLE.payments).insert({
                coach_id: offerCoachId,
                client_id: publicClientsRowId,
                stripe_customer_id: (session.customer as string) ?? null,
                stripe_subscription_id: offerSubId,
                status: "active",
                last_invoice_status: "paid",
                created_at: now,
                updated_at: now,
              });
            }
          }
          safeLogWebhook("checkout.session.completed", { objectId: session.id });
          break;
        }

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
          const profileId = await resolveCoachProfileId(supabase, {
            coachId,
            stripeCustomerId: (session.customer as string) ?? null,
            stripeSubscriptionId: subId || null,
          });
          if (profileId) {
            await syncCoachBillingState(supabase, {
              coachProfileId: profileId,
              planTier,
              subscriptionStatus: "active",
              stripeCustomerId: (session.customer as string) ?? null,
              stripeSubscriptionId: subId || null,
              currentPeriodEnd,
              now,
            });
          }
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
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoice.subscription as string;
        if (!subId) break;
        const amountPaidCents = invoice.amount_paid ?? 0;
        let { data: pay } = await supabase.from(TABLE.payments).select("coach_id, client_id").eq("stripe_subscription_id", subId).single();
        if (!pay) {
          // Self-heal: client-offer subscriptions created before checkout wrote an
          // atlas_payments row can't be resolved from the DB — recover the coach/client
          // link from the subscription's Stripe metadata and backfill the row.
          try {
            const sub = await stripe.subscriptions.retrieve(subId);
            const md = sub?.metadata ?? {};
            if (md.client_offer === "1" && md.coach_id && md.clients_row_id) {
              await supabase.from(TABLE.payments).insert({
                coach_id: md.coach_id,
                client_id: md.clients_row_id,
                stripe_customer_id: (sub.customer as string) ?? null,
                stripe_subscription_id: subId,
                status: "active",
                last_invoice_status: "paid",
                created_at: now,
                updated_at: now,
              });
              pay = { coach_id: md.coach_id, client_id: md.clients_row_id };
            }
          } catch (_) {
            // Stripe lookup failed — continue without the bridge rather than failing the event.
          }
        }
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
        const profileId = await resolveCoachProfileId(supabase, {
          coachId: pay?.coach_id ?? null,
          stripeCustomerId: (invoice.customer as string) ?? null,
          stripeSubscriptionId: subId,
        });
        if (profileId) {
          let planTier: string | null = null;
          const { data: coachRow } = await supabase.from(TABLE.coaches).select("plan_tier").eq("user_id", profileId).single();
          planTier = coachRow?.plan_tier ?? null;
          await syncCoachBillingState(supabase, {
            coachProfileId: profileId,
            planTier,
            subscriptionStatus: "active",
            stripeCustomerId: (invoice.customer as string) ?? null,
            stripeSubscriptionId: subId,
            currentPeriodEnd: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
            now,
          });
        }
        if (pay?.client_id) {
          await supabase.from(TABLE.review_items).update({ status: "done", updated_at: now }).eq("coach_id", pay.coach_id).eq("client_id", pay.client_id).eq("type", "payment_overdue");
        }
        // Bridge into client_payments — Earnings/RevenueAnalytics read this table
        // (coach_id = profile id, amount in major units), not atlas_payments, so
        // Stripe-collected client payments are invisible to coaches without it.
        if (pay?.client_id && profileId && amountPaidCents > 0) {
          const paidAtSecs = invoice.status_transitions?.paid_at ?? null;
          const paidAtIso = paidAtSecs ? new Date(paidAtSecs * 1000).toISOString() : now;
          const { data: existingClientPayment } = await supabase
            .from("client_payments")
            .select("id, status")
            .eq("provider_payment_id", invoice.id)
            .maybeSingle();
          if (existingClientPayment?.id) {
            // A retry after invoice.payment_failed — promote the failed row to paid.
            if (existingClientPayment.status !== "paid") {
              await supabase.from("client_payments").update({
                status: "paid",
                amount: amountPaidCents / 100,
                paid_at: paidAtIso,
              }).eq("id", existingClientPayment.id);
              await recordPaymentAnalytics(supabase, {
                clientRowId: pay.client_id,
                coachProfileId: profileId,
                amountCents: amountPaidCents,
                currency: (invoice.currency ?? "gbp").toUpperCase(),
                invoiceId: invoice.id,
              });
            }
          } else {
            await supabase.from("client_payments").insert({
              client_id: pay.client_id,
              coach_id: profileId,
              amount: amountPaidCents / 100,
              currency: (invoice.currency ?? "gbp").toUpperCase(),
              status: "paid",
              payment_provider: "stripe",
              provider_payment_id: invoice.id,
              paid_at: paidAtIso,
            });
            await recordPaymentAnalytics(supabase, {
              clientRowId: pay.client_id,
              coachProfileId: profileId,
              amountCents: amountPaidCents,
              currency: (invoice.currency ?? "gbp").toUpperCase(),
              invoiceId: invoice.id,
            });
          }
        }
        safeLogWebhook(event.type, { objectId: invoice.id });
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
        const profileId = await resolveCoachProfileId(supabase, {
          coachId: pay?.coach_id ?? null,
          stripeCustomerId: (invoice.customer as string) ?? null,
          stripeSubscriptionId: subId,
        });
        if (profileId) {
          const { data: coachRow } = await supabase.from(TABLE.coaches).select("plan_tier").eq("user_id", profileId).single();
          await syncCoachBillingState(supabase, {
            coachProfileId: profileId,
            planTier: coachRow?.plan_tier ?? null,
            subscriptionStatus: "past_due",
            stripeCustomerId: (invoice.customer as string) ?? null,
            stripeSubscriptionId: subId,
            currentPeriodEnd: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
            now,
          });
        }
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
        // Mirror the failure into client_payments so the coach's failed-payments
        // panel (RevenueAnalytics) reflects Stripe declines, not just manual entries.
        if (pay?.client_id && profileId) {
          const { data: existingClientPayment } = await supabase
            .from("client_payments")
            .select("id, status")
            .eq("provider_payment_id", invoice.id)
            .maybeSingle();
          if (!existingClientPayment?.id) {
            await supabase.from("client_payments").insert({
              client_id: pay.client_id,
              coach_id: profileId,
              amount: (invoice.amount_due ?? 0) / 100,
              currency: (invoice.currency ?? "gbp").toUpperCase(),
              status: "failed",
              payment_provider: "stripe",
              provider_payment_id: invoice.id,
            });
          }
        }
        safeLogWebhook("invoice.payment_failed", { objectId: invoice.id });
        break;
      }
      case "charge.refunded": {
        // Without this, refunded payments stay 'paid' in client_payments and
        // the coach's revenue is overstated forever. charge.refunded is only
        // true when FULLY refunded — partial refunds keep the row as paid.
        const charge = event.data.object as Stripe.Charge;
        const invoiceId = (charge.invoice as string) ?? null;
        if (!invoiceId || charge.refunded !== true) {
          safeLogWebhook("charge.refunded", { objectId: charge.id });
          break;
        }
        await supabase
          .from("client_payments")
          .update({ status: "refunded" })
          .eq("provider_payment_id", invoiceId);
        safeLogWebhook("charge.refunded", { objectId: charge.id });
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
      case "customer.subscription.created":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const status = sub.status === "active" ? "active" : sub.status === "past_due" ? "past_due" : "canceled";
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
        const profileId = await resolveCoachProfileId(supabase, {
          coachId: coachIdSub,
          stripeCustomerId: (sub.customer as string) ?? null,
          stripeSubscriptionId: sub.id,
        });
        if (profileId) {
          await syncCoachBillingState(supabase, {
            coachProfileId: profileId,
            planTier,
            subscriptionStatus: status,
            stripeCustomerId: (sub.customer as string) ?? null,
            stripeSubscriptionId: sub.id,
            currentPeriodEnd: periodEnd,
            now,
          });
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
