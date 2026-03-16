/**
 * Get a single message thread (conversation) by id. Uses message_threads.
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
    const id = body.id ?? req.headers.get("X-Conversation-Id");
    if (!id) {
      return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: row, error } = await supabase
      .from("message_threads")
      .select("id, coach_id, client_id, created_at, updated_at")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      return jsonError("Request failed", 500);
    }
    if (!row) {
      return new Response(JSON.stringify(null), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const r = row as Record<string, unknown>;
    const coachId = r.coach_id as string | null;
    const clientId = r.client_id as string | null;
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
    const out = {
      id: (row as Record<string, unknown>).id,
      trainer_id: (row as Record<string, unknown>).coach_id,
      client_id: (row as Record<string, unknown>).client_id,
      created_at: (row as Record<string, unknown>).created_at,
      updated_at: (row as Record<string, unknown>).updated_at,
    };
    return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("conversation-get", e);
    return jsonError("Request failed", 500);
  }
});
