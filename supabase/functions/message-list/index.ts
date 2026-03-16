/**
 * List messages for a thread. Uses message_messages.
 * Caller must be the coach or the client in the thread.
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
    const conversationId = body.conversation_id ?? body.thread_id;
    if (!conversationId) {
      return new Response(JSON.stringify({ error: "conversation_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: thread } = await supabase
      .from("message_threads")
      .select("coach_id, client_id")
      .eq("id", conversationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!thread) {
      return new Response(JSON.stringify({ error: "Thread not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
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
    if (!isCoach && !isClient) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: rows, error } = await supabase
      .from("message_messages")
      .select("id, thread_id, sender_role, message_text, created_at")
      .eq("thread_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      return jsonError("Request failed", 500);
    }
    const list = Array.isArray(rows) ? rows : [];
    const out = list.map((r: Record<string, unknown>) => ({
      id: r.id,
      conversation_id: r.thread_id,
      thread_id: r.thread_id,
      text: r.message_text,
      message_text: r.message_text,
      sender_role: r.sender_role,
      sender_type: r.sender_role,
      created_at: r.created_at,
      created_date: r.created_at,
    }));
    return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("message-list", e);
    return jsonError("Request failed", 500);
  }
});
