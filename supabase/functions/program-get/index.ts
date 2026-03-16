/**
 * Get a program by id. Uses program_blocks. Caller must be the client (clients.user_id) or the client's coach.
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
    const id = body.id ?? req.headers.get("X-Program-Id");
    if (!id) {
      return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: row, error } = await supabase
      .from("program_blocks")
      .select("id, client_id, phase_id, title, total_weeks, created_at")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return jsonError("Request failed", 500);
    }
    if (!row) {
      return new Response(JSON.stringify(null), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const clientId = (row as Record<string, unknown>).client_id as string | null;
    if (clientId) {
      const { data: client } = await supabase.from("clients").select("user_id, coach_id, trainer_id").eq("id", clientId).maybeSingle();
      const c = client as Record<string, unknown> | null;
      const clientUserId = c?.user_id as string | null;
      const coachId = c?.coach_id as string | null;
      const trainerId = c?.trainer_id as string | null;
      const isOwner = clientUserId === callerId;
      const isCoach = coachId === callerId || trainerId === callerId;
      if (!isOwner && !isCoach) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    const out = {
      ...row,
      name: (row as Record<string, unknown>).title,
      trainer_id: null,
      created_date: (row as Record<string, unknown>).created_at,
    };
    return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("program-get", e);
    return jsonError("Request failed", 500);
  }
});
