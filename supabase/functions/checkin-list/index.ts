/**
 * List check-ins for a client. Caller must be the client or the client's coach.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getAuthUserId, requireAuthResponse, assertCoachOwnsClient, jsonError } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const callerId = await getAuthUserId(req);
    const authErr = requireAuthResponse(callerId);
    if (authErr) return authErr;

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const clientId = body.client_id ?? body.clientId;
    const status = body.status as string | undefined;
    if (!clientId) return jsonError("client_id required", 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const forbid = await assertCoachOwnsClient(supabase, clientId, callerId);
    if (forbid) return forbid;

    let query = supabase
      .from("checkins")
      .select(`
        id,
        client_id,
        week_start,
        submitted_at,
        focus_type,
        weight,
        steps_avg,
        sleep_score,
        energy_level,
        training_completion,
        nutrition_adherence,
        wins,
        struggles,
        questions,
        photos,
        reviewed_at,
        reviewed_by,
        condition_notes,
        created_at
      `)
      .eq("client_id", clientId)
      .order("submitted_at", { ascending: false });

    const { data: rows, error } = await query;

    if (error) {
      return jsonError("Request failed", 500);
    }
    const list = Array.isArray(rows) ? rows : [];

    const { data: clientRow } = await supabase.from("clients").select("coach_id, trainer_id").eq("id", clientId).maybeSingle();
    const coachId = (clientRow as Record<string, unknown>)?.coach_id ?? (clientRow as Record<string, unknown>)?.trainer_id ?? null;

    const out = list.map((r: Record<string, unknown>) => {
      const submitted = r.submitted_at != null;
      const rowStatus = String(r.status ?? (submitted ? "submitted" : "pending"));
      if (status != null && status !== "" && rowStatus !== status) return null;
      return {
        ...r,
        trainer_id: coachId,
        status: rowStatus,
        created_date: r.submitted_at ?? r.created_at ?? r.week_start,
        checkin_date: r.week_start ?? r.submitted_at ?? r.created_at,
        due_date: r.week_start,
        notes: r.condition_notes ?? r.questions ?? null,
        weight_kg: r.weight,
        steps: r.steps_avg,
        adherence_pct: r.nutrition_adherence ?? r.training_completion ?? null,
        sleep_hours: r.sleep_score,
        flags: [],
      };
    }).filter(Boolean);

    return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("checkin-list", e);
    return jsonError("Request failed", 500);
  }
});
