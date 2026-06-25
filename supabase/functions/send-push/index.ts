// Send push notification to a profile's devices via FCM v1 API (service account OAuth2).
// Body: { profile_id, title, body, data? }. Requires JWT; for message_received, data.thread_id required
// and caller must be the other participant in the thread.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getAuthUserId } from "../_shared/auth.ts";

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function b64url(str: string): string {
  return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getFCMAccessToken(): Promise<string | null> {
  const saJson = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
  if (!saJson) return null;
  let sa: { client_email: string; private_key: string };
  try {
    sa = JSON.parse(saJson);
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${header}.${payload}`;
  let privateKey: CryptoKey;
  try {
    privateKey = await crypto.subtle.importKey(
      "pkcs8",
      pemToArrayBuffer(sa.private_key),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
  } catch {
    return null;
  }
  const sigBuf = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(signingInput));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwt = `${signingInput}.${sig}`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!tokenRes.ok) return null;
  const tokenData = await tokenRes.json();
  return typeof tokenData.access_token === "string" ? tokenData.access_token : null;
}

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

    const { data: tokens, error: tokensError } = await supabase
      .from("device_push_tokens")
      .select("device_token, platform")
      .eq("user_id", profileId);

    if (tokensError || !tokens?.length) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, reason: "no_tokens" }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const projectId = Deno.env.get("FCM_PROJECT_ID");
    if (!projectId) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, reason: "FCM_PROJECT_ID not set" }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const accessToken = await getFCMAccessToken();
    if (!accessToken) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, reason: "FCM_SERVICE_ACCOUNT_JSON not configured or invalid" }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    let sent = 0;
    for (const row of tokens) {
      const token = row?.device_token;
      if (!token) continue;
      const res = await fetch(fcmUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body: bodyText },
            data: Object.fromEntries(
              Object.entries({ ...data, title, body: bodyText }).map(([k, v]) => [k, String(v)])
            ),
          },
        }),
      });
      if (res.ok) sent += 1;
    }

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
