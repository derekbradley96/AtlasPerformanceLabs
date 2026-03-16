/**
 * Get a single client profile by id. Uses public.clients.
 * Caller must be the client (user_id) or the client's coach (coach_id/trainer_id).
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
    const id = body.id ?? body.client_id ?? req.headers.get("X-Client-Id");
    if (!id) {
      return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: row, error } = await supabase
      .from("clients")
      .select("id, user_id, coach_id, trainer_id, name, full_name, phase, phase_started_at, baseline_weight, gym_name, created_at, monthly_fee, next_due_date, billing_status, lifecycle_stage, membership_type")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return jsonError("Request failed", 500);
    }
    if (!row) {
      return new Response(JSON.stringify(null), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const r = row as Record<string, unknown>;
    const userId = r.user_id as string | null;
    const coachId = r.coach_id as string | null;
    const trainerId = r.trainer_id as string | null;
    const isOwner = userId === callerId;
    const isCoach = coachId === callerId || trainerId === callerId;
    if (!isOwner && !isCoach) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const out = { ...row, subscription_status: r.billing_status ?? "active" };
    return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("client-profile-get", e);
    return jsonError("Request failed", 500);
  }
});
