/**
 * Update a message. Caller must be a participant in the message's thread.
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

    const payload: Record<string, unknown> = {};
    if (body.read_at !== undefined) payload.read_at = body.read_at;
    if (Object.keys(payload).length === 0) {
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: msg } = await supabase.from("message_messages").select("thread_id").eq("id", id).maybeSingle();
    if (!msg) return jsonError("Message not found", 404);
    const threadId = (msg as { thread_id?: string }).thread_id;
    if (threadId) {
      const { data: thread } = await supabase.from("message_threads").select("coach_id, client_id").eq("id", threadId).maybeSingle();
      if (thread) {
        const t = thread as Record<string, unknown>;
        const coachId = t.coach_id as string | null;
        const clientId = t.client_id as string | null;
        let clientUserId: string | null = null;
        if (clientId) {
          const { data: client } = await supabase.from("clients").select("user_id").eq("id", clientId).maybeSingle();
          clientUserId = (client as { user_id?: string } | null)?.user_id ?? null;
        }
        if (coachId !== callerId && clientUserId !== callerId) return jsonError("Forbidden", 403);
      }
    }
    const { error } = await supabase.from("message_messages").update(payload).eq("id", id);
    if (error) {
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("message-update", e);
    return jsonError("Request failed", 500);
  }
});
