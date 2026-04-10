/**
 * Get a single check-in by id. Uses public.checkins.
 * Caller must be the client (clients.user_id) or the client's coach (coach_id/trainer_id).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getAuthUserId, jsonError } from "../_shared/auth.ts";
import { parseCheckinTemplateAnswers } from "../_shared/checkinTemplateAnswers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const callerId = await getAuthUserId(req);
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const id = body.id ?? req.headers.get("X-Checkin-Id");
    if (!id) {
      return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: row, error } = await supabase
      .from("checkins")
      .select(`
        id, client_id, week_start, submitted_at, focus_type, weight, steps_avg, sleep_score,
        energy_level, mood_level, training_completion, nutrition_adherence, wins, struggles, questions, photos,
        reviewed_at, reviewed_by, condition_notes, created_at
      `)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!row) {
      return new Response(JSON.stringify(null), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: clientRow } = await supabase.from("clients").select("user_id, coach_id, trainer_id").eq("id", (row as Record<string, unknown>).client_id).maybeSingle();
    const c = clientRow as Record<string, unknown> | null;
    const clientUserId = c?.user_id as string | null;
    const coachId = c?.coach_id as string | null;
    const trainerId = c?.trainer_id as string | null;
    const isOwner = clientUserId === callerId;
    const isCoach = coachId === callerId || trainerId === callerId;
    if (!isOwner && !isCoach) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const trainerIdOut = coachId ?? trainerId ?? null;
    const submitted = (row as Record<string, unknown>).submitted_at != null;
    const qRaw = (row as Record<string, unknown>).questions;
    const templateAnswers = parseCheckinTemplateAnswers(qRaw);
    const conditionNotes = (row as Record<string, unknown>).condition_notes;
    const notesLegacyQuestions =
      typeof qRaw === "string" && templateAnswers.length === 0 && String(qRaw).trim() !== ""
        ? String(qRaw)
        : null;
    const out = {
      ...row,
      sleep_quality: (row as Record<string, unknown>).sleep_score,
      answers: templateAnswers.length > 0 ? templateAnswers : undefined,
      trainer_id: trainerIdOut,
      status: submitted ? "submitted" : "pending",
      created_date: (row as Record<string, unknown>).submitted_at ?? (row as Record<string, unknown>).created_at ?? (row as Record<string, unknown>).week_start,
      checkin_date: (row as Record<string, unknown>).week_start,
      due_date: (row as Record<string, unknown>).week_start,
      notes: (conditionNotes as string | null | undefined) ?? notesLegacyQuestions ?? undefined,
      weight_kg: (row as Record<string, unknown>).weight,
      steps: (row as Record<string, unknown>).steps_avg,
      adherence_pct: (row as Record<string, unknown>).nutrition_adherence ?? (row as Record<string, unknown>).training_completion,
      sleep_hours: (row as Record<string, unknown>).sleep_score,
      flags: [],
    };
    return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("checkin-get", e);
    return jsonError("Request failed", 500);
  }
});
