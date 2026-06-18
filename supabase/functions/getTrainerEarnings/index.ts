/**
 * Coach earnings summary. Caller = coach (JWT only).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { getCorsHeaders } from "../_shared/cors.ts";
import { TABLE } from "../_shared/supabase.ts";
import { getAuthUserId, requireAuthResponse, jsonError } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  try {
    const callerId = await getAuthUserId(req);
    const authErr = requireAuthResponse(callerId);
    if (authErr) return authErr;
    const userId = callerId;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: coach, error: coachErr } = await supabase
      .from(TABLE.coaches)
      .select("id, user_id, stripe_account_id, plan_tier, stripe_customer_id, subscription_status")
      .eq("user_id", userId)
      .maybeSingle();

    if (coachErr) {
      return new Response(JSON.stringify({ error: coachErr.message }), { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    // Active clients: public.clients where coach_id = userId (auth.uid()); trainer_id for legacy
    const { count: clientCount, error: clientErr } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .or(`coach_id.eq.${userId},trainer_id.eq.${userId}`);

    const activeClients = clientErr ? 0 : (clientCount ?? 0);

    let monthlyRevenue = 0;
    let lifetimeEarnings = 0;
    let pendingPayouts = 0;
    let overdueAmount = 0;
    let hasPaymentHistory = false;
    const currentPlan = (coach?.plan_tier ?? "basic").toLowerCase();

    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeSecret && coach?.stripe_account_id) {
      const stripe = new Stripe(stripeSecret, { apiVersion: "2024-11-20.acacia" });
      try {
        const balance = await stripe.balance.retrieve({ stripeAccount: coach.stripe_account_id });
        const available = balance.available?.[0];
        if (available) pendingPayouts = available.amount;
      } catch (e) {
        console.error("getTrainerEarnings Stripe balance:", e);
      }
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const nowIso = now.toISOString();

    const { data: payments, error: paymentsErr } = await supabase
      .from("client_payments")
      .select("amount, status, created_at, due_date")
      .or(`coach_id.eq.${userId},trainer_id.eq.${userId}`);
    if (paymentsErr) console.error("getTrainerEarnings payments:", paymentsErr);

    const rows = payments ?? [];
    const allPaid = rows.filter((p) => p?.status === "paid");
    lifetimeEarnings = allPaid.reduce((sum, p) => sum + Number(p?.amount || 0), 0);
    monthlyRevenue = allPaid
      .filter((p) => String(p?.created_at || "") >= monthStart)
      .reduce((sum, p) => sum + Number(p?.amount || 0), 0);
    pendingPayouts += rows
      .filter((p) => p?.status === "pending")
      .reduce((sum, p) => sum + Number(p?.amount || 0), 0);
    overdueAmount = rows.reduce((sum, row) => {
      const amt = Number(row?.amount || 0);
      if (row?.status === "overdue") return sum + amt;
      if (row?.status === "pending" && row?.due_date && String(row.due_date) < nowIso.slice(0, 10)) return sum + amt;
      return sum;
    }, 0);
    hasPaymentHistory = allPaid.length > 0;

    // Upgrade savings: 10% basic vs 3% pro — (monthlyRevenue * 0.10) - (monthlyRevenue * 0.03) when on basic
    const upgradeSavings = currentPlan !== "pro" && currentPlan !== "elite" ? Math.round(monthlyRevenue * (0.1 - 0.03)) : 0;

    return new Response(
      JSON.stringify({
        monthlyRevenue,
        lifetimeEarnings,
        pendingPayouts,
        overdueAmount,
        hasPaymentHistory,
        activeClients,
        currentPlan,
        upgradeSavings,
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("getTrainerEarnings", e);
    return jsonError("Request failed", 500);
  }
});
