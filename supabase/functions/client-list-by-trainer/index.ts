/**
 * List clients for a coach. Uses coach_id or trainer_id.
 * Caller must be the coach (can only list own clients).
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
    const trainerId = body.trainer_id ?? body.coach_id ?? body.user_id ?? req.headers.get("X-User-Id") ?? callerId;
    if (trainerId !== callerId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: rows, error } = await supabase
      .from("clients")
      .select("id, user_id, coach_id, trainer_id, name, full_name, phase, created_at, billing_status, lifecycle_stage")
      .or(`coach_id.eq.${trainerId},trainer_id.eq.${trainerId}`)
      .order("created_at", { ascending: false });

    if (error) {
      return jsonError("Request failed", 500);
    }
    const list = Array.isArray(rows) ? rows : [];
    return new Response(JSON.stringify(list), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("client-list-by-trainer", e);
    return jsonError("Request failed", 500);
  }
});
