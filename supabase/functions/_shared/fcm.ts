// Shared FCM v1 push delivery (service-account OAuth2).
// Used by send-push (user-initiated) and scheduled functions (send-reminders, retention-alerts)
// so server-created notifications also reach devices.

// deno-lint-ignore-file no-explicit-any

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

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getFCMAccessToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.token;
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
  if (typeof tokenData.access_token !== "string") return null;
  cachedToken = { token: tokenData.access_token, expiresAt: Date.now() + 3600_000 };
  return cachedToken.token;
}

/**
 * Send a push to every registered device for a profile. Never throws — returns devices reached.
 * `supabase` must be a service-role client (reads device_push_tokens).
 */
export async function sendPushToProfile(
  supabase: any,
  { profileId, title, body, data }: {
    profileId: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  },
): Promise<number> {
  try {
    if (!profileId) return 0;
    const projectId = Deno.env.get("FCM_PROJECT_ID");
    if (!projectId) return 0;

    const { data: tokens, error } = await supabase
      .from("device_push_tokens")
      .select("device_token")
      .eq("user_id", profileId);
    if (error || !tokens?.length) return 0;

    const accessToken = await getFCMAccessToken();
    if (!accessToken) return 0;

    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    const stringData = Object.fromEntries(
      Object.entries({ ...(data ?? {}), title, body }).map(([k, v]) => [k, String(v ?? "")]),
    );
    let sent = 0;
    for (const row of tokens) {
      const token = (row as { device_token?: string })?.device_token;
      if (!token) continue;
      const res = await fetch(fcmUrl, {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: { token, notification: { title, body }, data: stringData },
        }),
      });
      if (res.ok) sent += 1;
    }
    return sent;
  } catch (e) {
    console.error("sendPushToProfile", e);
    return 0;
  }
}
