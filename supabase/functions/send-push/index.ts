// Send push notification to a profile's devices via FCM (legacy API).
// Body: { profile_id, title, body, data? }. Requires JWT; for message_received, data.thread_id required and caller must be the other participant in the thread.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getAuthUserId } from "../_shared/auth.ts";

const FCM_LEGACY_URL = "https://fcm.googleapis.com/fcm/send";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const callerId = await getAuthUserId(req);
    if (!callerId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized", sent: 0 }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({})) as {
      profile_id?: string;
      title?: string;
      body?: string;
      data?: Record<string, string>;
    };
    const profileId = body?.profile_id;
    const title = typeof body?.title === "string" ? body.title : "Notification";
    const bodyText = typeof body?.body === "string" ? body.body : "";
    const data = body?.data && typeof body.data === "object" ? body.data : {};

    if (!profileId) {
      return new Response(
        JSON.stringify({ ok: false, error: "profile_id required", sent: 0 }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // For message_received we require thread_id and verify caller is the other participant (prevents push spam/IDOR).
    if (data?.type === "message_received") {
      const threadId = data.thread_id;
      if (!threadId) {
        return new Response(
          JSON.stringify({ ok: false, error: "thread_id required in data for message_received", sent: 0 }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: thread, error: threadErr } = await supabase
        .from("message_threads")
        .select("coach_id, client_id")
        .eq("id", threadId)
        .maybeSingle();
      if (threadErr || !thread) {
        return new Response(
          JSON.stringify({ ok: false, error: "Thread not found", sent: 0 }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const coachId = (thread as { coach_id?: string }).coach_id ?? null;
      const clientId = (thread as { client_id?: string }).client_id ?? null;
      let clientUserId: string | null = null;
      if (clientId) {
        const { data: client } = await supabase.from("clients").select("user_id").eq("id", clientId).maybeSingle();
        clientUserId = (client as { user_id?: string } | null)?.user_id ?? null;
      }
      const callerIsCoach = coachId === callerId;
      const callerIsClient = clientUserId === callerId;
      const recipientIsCoach = profileId === coachId;
      const recipientIsClient = profileId === clientUserId;
      if (!callerIsCoach && !callerIsClient) {
        return new Response(
          JSON.stringify({ ok: false, error: "Forbidden", sent: 0 }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!recipientIsCoach && !recipientIsClient) {
        return new Response(
          JSON.stringify({ ok: false, error: "Forbidden", sent: 0 }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Only message_received is allowed from the app; other types would require separate authorization.
      return new Response(
        JSON.stringify({ ok: false, error: "Forbidden", sent: 0 }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: tokens, error: tokensError } = await supabase
      .from("device_push_tokens")
      .select("device_token, platform")
      .eq("user_id", profileId);

    if (tokensError || !tokens?.length) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, reason: "no_tokens" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fcmKey = Deno.env.get("FCM_SERVER_KEY") ?? Deno.env.get("FIREBASE_SERVER_KEY");
    if (!fcmKey || typeof fcmKey !== "string" || !fcmKey.trim()) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, reason: "FCM_SERVER_KEY not set" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sent = 0;
    for (const row of tokens) {
      const token = row?.device_token;
      if (!token) continue;
      const res = await fetch(FCM_LEGACY_URL, {
        method: "POST",
        headers: {
          "Authorization": `key=${fcmKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: token,
          notification: { title, body: bodyText },
          data: { ...data, title, body: bodyText },
        }),
      });
      if (res.ok) sent += 1;
    }

    return new Response(
      JSON.stringify({ ok: true, sent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("send-push", e);
    return new Response(
      JSON.stringify({ ok: false, error: "Request failed", sent: 0 }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
