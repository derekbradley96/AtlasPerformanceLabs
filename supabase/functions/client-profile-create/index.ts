/**
 * Create (or update) a client profile (link a user to a coach).
 * Caller can be: (1) the coach (coach_id === JWT), or (2) the client (user_id === JWT) during self-onboarding.
 * Supports onboarding fields and coach document acceptances.
 *
 * Ownership: clients.coach_id and clients.trainer_id are both the coach profile UUID (auth uid),
 * matching coach-side manual add / import (`supabaseClientsRepo.createClient`).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getAuthUserId, requireAuthResponse, jsonError } from "../_shared/auth.ts";
import { validateSelectedServiceForCoach } from "../_shared/clientSelectedService.ts";

/** Align with app `supabaseClientsRepo`: coach_id and trainer_id are both the coach profile UUID (auth uid). */
function normalizeClientTypeForInsert(raw: unknown): string {
  const s = String(raw ?? "transformation").trim().toLowerCase();
  if (s === "competition" || s === "integrated" || s === "transformation") return s;
  return "transformation";
}

function deriveDeliveryContext(clientType: string, hasPrepShowDate: boolean): "transformation" | "competition" {
  if (clientType === "competition") return "competition";
  if (clientType === "integrated" && hasPrepShowDate) return "competition";
  return "transformation";
}

function assertCanonicalCoachClientRow(row: Record<string, unknown>, source: string): void {
  const coach = row.coach_id != null ? String(row.coach_id) : "";
  const train = row.trainer_id != null ? String(row.trainer_id) : "";
  if (coach && train && coach !== train) {
    console.error(`[ATLAS] Canonical client invariant (${source}): coach_id !== trainer_id`, { coach, train });
  }
  if (!String(row.name ?? "").trim()) {
    console.error(`[ATLAS] Canonical client invariant (${source}): empty name`);
  }
}

/** Paid online coach package (atlas_services) → pending_payment until Stripe checkout completes; else active. */
async function deriveCoachOfferBillingStatus(
  supabase: ReturnType<typeof createClient>,
  selectedServiceId: string | null | undefined,
): Promise<"active" | "pending_payment"> {
  if (!selectedServiceId || typeof selectedServiceId !== "string") return "active";
  const { data: svcRow } = await supabase
    .from("atlas_services")
    .select("price_amount, stripe_price_id")
    .eq("id", selectedServiceId)
    .maybeSingle();
  if (!svcRow) return "active";
  const cents = Number((svcRow as { price_amount?: unknown }).price_amount ?? 0);
  const priceId = (svcRow as { stripe_price_id?: string | null }).stripe_price_id;
  const hasStripePrice = typeof priceId === "string" && priceId.trim().length > 0;
  if (cents > 0 && hasStripePrice) return "pending_payment";
  return "active";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  try {
    const callerId = await getAuthUserId(req);
    const authErr = requireAuthResponse(callerId);
    if (authErr) return authErr;

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const userId = body.user_id ?? body.client_user_id;
    const coachId = body.coach_id ?? body.trainer_id;
    if (!userId) return jsonError("user_id required", 400);
    if (!coachId) return jsonError("coach_id required", 400);

    const isCoachCaller = coachId === callerId;
    const isClientSelfOnboarding = userId === callerId;
    if (!isCoachCaller && !isClientSelfOnboarding) return jsonError("Forbidden", 403);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const clientType = normalizeClientTypeForInsert(body.client_type ?? body.client_journey);
    const showRaw = typeof body.show_date === "string" ? body.show_date.trim().slice(0, 10) : "";
    const hasPrepShow = /^\d{4}-\d{2}-\d{2}$/.test(showRaw);
    const delivery_context = deriveDeliveryContext(clientType, hasPrepShow);

    const nameRaw = body.name ?? body.full_name ?? null;
    const name = (nameRaw != null && String(nameRaw).trim() !== "") ? String(nameRaw).trim() : "Client";

    const row: Record<string, unknown> = {
      user_id: userId,
      coach_id: coachId,
      trainer_id: coachId,
      name,
      client_type: clientType,
      delivery_context,
    };
    if (hasPrepShow && (clientType === "competition" || clientType === "integrated")) {
      row.show_date = showRaw;
    }
    if (body.phase != null) row.phase = body.phase;
    if (body.monthly_fee != null) row.monthly_fee = body.monthly_fee;
    if (body.next_due_date != null) row.next_due_date = body.next_due_date;
    if (body.age != null) row.age = body.age;
    if (body.goals != null) row.goals = body.goals;
    if (body.previous_experience != null) row.previous_experience = body.previous_experience;
    if (body.medical_history != null) row.medical_history = body.medical_history;
    if (body.onboarding_notes != null) row.onboarding_notes = body.onboarding_notes;
    if (body.baseline_weight != null) row.baseline_weight = body.baseline_weight;
    if (body.training_days_per_week != null) row.training_days_per_week = body.training_days_per_week;
    if (body.injuries != null) row.injuries = body.injuries;

    if (body.selected_service_id !== undefined || body.service_id !== undefined) {
      const rawSvc = body.selected_service_id !== undefined ? body.selected_service_id : body.service_id;
      const v = await validateSelectedServiceForCoach(supabase, coachId, rawSvc);
      if (!v.ok) return jsonError(v.message, v.status);
      row.selected_service_id = v.id;
    }

    let billingStatus: "active" | "pending_payment" | "overdue" | "paused" = await deriveCoachOfferBillingStatus(
      supabase,
      row.selected_service_id as string | null | undefined,
    );
    if (isCoachCaller) {
      const raw = body.billing_status ?? body.subscription_status;
      if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
        const b = String(raw).trim().toLowerCase();
        if (b === "active" || b === "overdue" || b === "paused" || b === "pending_payment") {
          billingStatus = b as typeof billingStatus;
        }
      }
    }
    row.billing_status = billingStatus;

    const { data: existing } = await supabase.from("clients").select("id").eq("user_id", userId).eq("coach_id", coachId).maybeSingle();
    let data: Record<string, unknown>;

    if (existing?.id) {
      const { data: updated, error } = await supabase.from("clients").update(row).eq("id", (existing as { id: string }).id).select("id, user_id, coach_id, trainer_id, name, billing_status, selected_service_id, training_days_per_week, injuries, client_type, delivery_context").single();
      if (error) {
        console.error("client-profile-create update", error);
        return jsonError("Request failed", 500);
      }
      data = updated as Record<string, unknown>;
    } else {
      const { data: inserted, error } = await supabase.from("clients").insert(row).select("id, user_id, coach_id, trainer_id, name, billing_status, selected_service_id, training_days_per_week, injuries, client_type, delivery_context").single();
      if (error) {
        console.error("client-profile-create insert", error);
        return new Response(
          JSON.stringify({ error: "Request failed", details: error.message, code: error.code }),
          { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
      data = inserted as Record<string, unknown>;
    }

    assertCanonicalCoachClientRow(data as Record<string, unknown>, "client-profile-create");

    const clientId = data.id as string;

    if (!existing?.id && hasPrepShow && (clientType === "competition" || clientType === "integrated") && clientId) {
      const prepRow = {
        client_id: clientId,
        show_date: showRaw,
        federation: typeof body.federation === "string" ? body.federation.trim() || null : null,
        show_name: typeof body.show_name === "string" ? body.show_name.trim() || null : null,
        division: typeof body.division === "string" ? body.division.trim() || null : null,
        is_active: true,
      };
      const { error: prepErr } = await supabase.from("contest_preps").insert(prepRow);
      if (prepErr) console.warn("client-profile-create contest_preps insert:", prepErr.message, prepErr.code);
    }
    const acceptedDocIds = Array.isArray(body.accepted_document_ids) ? body.accepted_document_ids : [];
    for (const docId of acceptedDocIds) {
      if (typeof docId !== "string") continue;
          await supabase.from("client_document_acceptances").upsert(
            { client_id: clientId, document_id: docId, accepted_at: new Date().toISOString() },
            { onConflict: "client_id,document_id" }
          );
    }

    // Ensure this user's profile role is client (so they show as client, not personal).
    const { data: prevProfile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
    const prevRole = (prevProfile as { role?: string } | null)?.role;
    const profilePatch: Record<string, unknown> = { role: "client" };
    if (prevRole === "personal") {
      profilePatch.linked_from_personal_at = new Date().toISOString();
    }
    if (isClientSelfOnboarding) {
      profilePatch.display_name = name;
      profilePatch.onboarding_complete = billingStatus === "active";
    }
    await supabase.from("profiles").update(profilePatch).eq("id", userId);

    const out = { ...data, subscription_status: (data.billing_status as string) ?? "active" };
    return new Response(JSON.stringify(out), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  } catch (e) {
    console.error("client-profile-create", e);
    return jsonError("Request failed", 500);
  }
});
