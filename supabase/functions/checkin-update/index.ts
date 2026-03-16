/**
 * Update a check-in by id. Caller must be the client (clients.user_id) or the client's coach.
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
    const id = body.id;
    if (!id) {
      return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: existing } = await supabase.from("checkins").select("id, client_id").eq("id", id).maybeSingle();
    if (!existing) {
      return new Response(JSON.stringify({ error: "Check-in not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: clientRow } = await supabase.from("clients").select("user_id, coach_id, trainer_id").eq("id", (existing as Record<string, unknown>).client_id).maybeSingle();
    const c = clientRow as Record<string, unknown> | null;
    const clientUserId = c?.user_id as string | null;
    const coachId = c?.coach_id as string | null;
    const trainerId = c?.trainer_id as string | null;
    const isOwner = clientUserId === callerId;
    const isCoach = coachId === callerId || trainerId === callerId;
    if (!isOwner && !isCoach) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const allowed = [
      "status", "submitted_at", "reviewed_at", "reviewed_by",
      "weight", "weight_kg", "steps_avg", "steps", "sleep_score", "sleep_hours",
      "energy_level", "training_completion", "nutrition_adherence", "adherence_pct",
      "wins", "struggles", "questions", "condition_notes", "notes", "photos",
    ];
    const payload: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) payload[key] = body[key];
    }
    if (body.status === "submitted" && body.submitted_at === undefined) payload.submitted_at = new Date().toISOString();
    if (payload.weight_kg !== undefined && payload.weight === undefined) payload.weight = payload.weight_kg;
    if (payload.steps !== undefined && payload.steps_avg === undefined) payload.steps_avg = payload.steps;
    if (payload.notes !== undefined && payload.condition_notes === undefined) payload.condition_notes = payload.notes;
    delete payload.weight_kg;
    delete payload.steps;
    delete payload.notes;

    const { data: updated, error } = await supabase
      .from("checkins")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return jsonError("Request failed", 500);
    }
    return new Response(JSON.stringify(updated), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("checkin-update", e);
    return jsonError("Request failed", 500);
  }
});
