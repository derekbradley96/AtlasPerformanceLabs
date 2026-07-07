// Send push notification to a profile's devices via FCM v1 API (service account OAuth2).
// Body: { profile_id, title, body, data? }. Requires JWT; for message_received, data.thread_id required
// and caller must be the other participant in the thread.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getAuthUserId } from "../_shared/auth.ts";
import { sendPushToProfile } from "../_shared/fcm.ts";
import { loadNotificationPrefs, isNotificationAllowed, type NotificationPrefKey } from "../_shared/notificationPrefs.ts";

/** Push type → notification_preferences column. Unmapped types are allowed. */
const PUSH_TYPE_PREF: Record<string, NotificationPrefKey> = {
  message_received: "messages",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  try {
    const callerId = await getAuthUserId(req);
    if (!callerId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized", sent: 0 }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
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
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // For message_received: require thread_id and verify caller is the other participant.
    if (data?.type === "message_received") {
      const threadId = data.thread_id;
      if (!threadId) {
        return new Response(
          JSON.stringify({ ok: false, error: "thread_id required in data for message_received", sent: 0 }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
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
          { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }
      const coachId = (thread as { coach_id?: string }).coach_id ?? null;
      const clientId = (thread as { client_id?: string }).client_id ?? null;
      let clientUserId: string | null = null;
      if (clientId) {
        const { data: client } = await supabase.from("clients").select("user_id").eq("id", clientId).maybeSingle();
        clientUserId = (client as { user_id?: string } | null)?.user_id ?? null;
      }
      if (coachId !== callerId && clientUserId !== callerId) {
        return new Response(
          JSON.stringify({ ok: false, error: "Forbidden", sent: 0 }),
          { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }
      if (profileId !== coachId && profileId !== clientUserId) {
        return new Response(
          JSON.stringify({ ok: false, error: "Forbidden", sent: 0 }),
          { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }
    } else if (data?.type === "action_required" || data?.type === "insight") {
      if (callerId !== profileId) {
        const { data: rel } = await supabase
          .from("clients")
          .select("id")
          .or(`and(coach_id.eq.${callerId},user_id.eq.${profileId}),and(user_id.eq.${callerId},coach_id.eq.${profileId})`)
          .limit(1)
          .maybeSingle();
        if (!rel) {
          return new Response(
            JSON.stringify({ ok: false, error: "Forbidden", sent: 0 }),
            { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
          );
        }
      }
    } else {
      return new Response(
        JSON.stringify({ ok: false, error: "Unsupported push type", sent: 0 }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // Recipient's notification preferences: an explicit false suppresses the push.
    const prefKey = PUSH_TYPE_PREF[String(data?.type ?? "")] ?? null;
    if (prefKey) {
      const prefs = await loadNotificationPrefs(supabase, [profileId]);
      if (!isNotificationAllowed(prefs, profileId, prefKey)) {
        return new Response(
          JSON.stringify({ ok: true, sent: 0, skipped: "preference" }),
          { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }
    }

    const sent = await sendPushToProfile(supabase, {
      profileId,
      title,
      body: bodyText,
      data,
    });

    return new Response(
      JSON.stringify({ ok: true, sent }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("send-push", e);
    return new Response(
      JSON.stringify({ ok: false, error: "Request failed", sent: 0 }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
