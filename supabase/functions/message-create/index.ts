/**
 * Create a message in a thread. Uses message_messages. Caller must be the coach or client in the thread.
 * Body: conversation_id (thread_id), text, sender_type (trainer|coach -> coach, client -> client).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getAuthUserId, jsonError } from "../_shared/auth.ts";
import { sendPushToProfile } from "../_shared/fcm.ts";

const payloadSchema = z.object({
  conversation_id: z.string().uuid().optional(),
  thread_id: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  text: z.string().max(4000).optional(),
  message_text: z.string().max(4000).optional(),
  sender_type: z.string().optional(),
  sender_role: z.string().optional(),
}).strict();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  try {
    const callerId = await getAuthUserId(req);
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    const rawBody = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const parsed = payloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError("Invalid request payload", 400);
    }
    const body = parsed.data;
    const threadId = body.conversation_id ?? body.thread_id ?? body.conversationId;
    const text = body.text ?? body.message_text ?? "";
    if (!threadId) {
      return new Response(JSON.stringify({ error: "conversation_id required" }), { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: thread, error: threadErr } = await supabase
      .from("message_threads")
      .select("coach_id, client_id")
      .eq("id", threadId)
      .is("deleted_at", null)
      .maybeSingle();
    if (threadErr || !thread) {
      return new Response(JSON.stringify({ error: "Thread not found" }), { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
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
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }
    // Never trust caller-provided sender role; derive from authenticated relationship.
    const senderRole = isCoach ? "coach" : "client";

    const { data: inserted, error } = await supabase
      .from("message_messages")
      .insert({ thread_id: threadId, sender_role: senderRole, message_text: text })
      .select("id, thread_id, sender_role, message_text, created_at")
      .single();

    if (error) {
      return jsonError("Request failed", 500);
    }

    // Push the recipient so coach feedback / client replies land on the lock screen.
    // Failures never block the send.
    try {
      const recipientId = isCoach ? clientUserId : coachId;
      if (recipientId) {
        const { data: senderProfile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", callerId)
          .maybeSingle();
        const senderName = String((senderProfile as { display_name?: string } | null)?.display_name || "").trim()
          || (isCoach ? "Your coach" : "Your client");
        const preview = String(text || "").slice(0, 120) || "New message";
        await sendPushToProfile(supabase, {
          profileId: recipientId,
          title: senderName,
          body: preview,
          data: {
            type: "message_received",
            thread_id: threadId,
            deep_link: clientId ? `/messages/${clientId}` : "/messages",
          },
        });
      }
    } catch (pushErr) {
      console.error("message-create push", pushErr);
    }

    const out = {
      ...inserted,
      conversation_id: (inserted as Record<string, unknown>).thread_id,
      text: (inserted as Record<string, unknown>).message_text,
      created_date: (inserted as Record<string, unknown>).created_at,
    };
    return new Response(JSON.stringify(out), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  } catch (e) {
    console.error("message-create", e);
    return jsonError("Request failed", 500);
  }
});
