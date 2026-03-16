/**
 * Update a client profile. Caller must be the client's coach (or the client for own profile).
 * When coach_id or trainer_id is provided, sets both so the coach stays attached.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getAuthUserId, jsonError } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const callerId = await getAuthUserId(req);
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const id = body.id ?? body.client_id;
    if (!id) {
      return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: existing } = await supabase.from("clients").select("user_id, coach_id, trainer_id").eq("id", id).maybeSingle();
    if (!existing) {
      return new Response(JSON.stringify({ error: "Client not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const e = existing as Record<string, unknown>;
    const isOwner = e.user_id === callerId;
    const isCoach = e.coach_id === callerId || e.trainer_id === callerId;
    if (!isOwner && !isCoach) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const coachId = body.coach_id ?? body.trainer_id;
    const updates: Record<string, unknown> = {};

    if (coachId != null) {
      updates.coach_id = coachId;
      updates.trainer_id = coachId;
    }
    if (body.name !== undefined) updates.name = body.name;
    if (body.full_name !== undefined) updates.full_name = body.full_name;
    if (body.billing_status !== undefined) updates.billing_status = body.billing_status;
    if (body.subscription_status !== undefined) updates.billing_status = body.subscription_status;
    if (body.phase !== undefined) updates.phase = body.phase;
    if (body.monthly_fee !== undefined) updates.monthly_fee = body.monthly_fee;
    if (body.next_due_date !== undefined) updates.next_due_date = body.next_due_date;
    if (body.lifecycle_stage !== undefined) updates.lifecycle_stage = body.lifecycle_stage;
    if (body.membership_type !== undefined) updates.membership_type = body.membership_type;

    if (Object.keys(updates).length === 0) {
      const { data: existing } = await supabase.from("clients").select("id, user_id, coach_id, trainer_id, name, full_name, billing_status").eq("id", id).single();
      return new Response(JSON.stringify(existing ?? null), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data, error } = await supabase.from("clients").update(updates).eq("id", id).select("id, user_id, coach_id, trainer_id, name, full_name, billing_status").single();

    if (error) {
      console.error("client-profile-update", error);
      return jsonError("Request failed", 500);
    }
    const out = data ? { ...data, subscription_status: (data as Record<string, unknown>).billing_status ?? "active" } : null;
    return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("client-profile-update", e);
    return jsonError("Request failed", 500);
  }
});
