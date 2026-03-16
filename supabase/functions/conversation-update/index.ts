/**
 * Update a message thread. Caller must be the coach or client in the thread.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getAuthUserId, requireAuthResponse, jsonError } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const callerId = await getAuthUserId(req);
    const authErr = requireAuthResponse(callerId);
    if (authErr) return authErr;

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const id = body.id;
    if (!id) return jsonError("id required", 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: thread } = await supabase.from("message_threads").select("coach_id, client_id").eq("id", id).maybeSingle();
    if (!thread) return jsonError("Thread not found", 404);
    const t = thread as Record<string, unknown>;
    const coachId = t.coach_id as string | null;
    const clientId = t.client_id as string | null;
    let clientUserId: string | null = null;
    if (clientId) {
      const { data: client } = await supabase.from("clients").select("user_id").eq("id", clientId).maybeSingle();
      clientUserId = (client as { user_id?: string } | null)?.user_id ?? null;
    }
    const isCoach = coachId === callerId;
    const isClient = clientUserId === callerId;
    if (!isCoach && !isClient) return jsonError("Forbidden", 403);

    const payload: Record<string, unknown> = {};
    if (body.updated_at !== undefined) payload.updated_at = body.updated_at;
    if (body.last_message_at !== undefined) payload.updated_at = body.last_message_at;
    if (!payload.updated_at) payload.updated_at = new Date().toISOString();

    const { error } = await supabase.from("message_threads").update(payload).eq("id", id);
    if (error) {
      return jsonError("Request failed", 500);
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("conversation-update", e);
    return jsonError("Request failed", 500);
  }
});
