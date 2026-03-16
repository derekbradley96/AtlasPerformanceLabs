/**
 * Shared auth for Edge Functions: resolve JWT from Authorization header, assert ownership.
 * Use anon key to validate token; never expose service role to caller.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "./cors.ts";

/**
 * Returns the authenticated user's id (auth.uid()) or null if missing/invalid.
 */
export async function getAuthUserId(req: Request): Promise<string | null> {
  const user = await getAuthenticatedUser(req);
  return user?.id ?? null;
}

/**
 * Returns { id } for the authenticated user or null. Use when you need the caller identity.
 */
export async function getAuthenticatedUser(req: Request): Promise<{ id: string } | null> {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) return null;

  try {
    const supabase = createClient(url, anonKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user?.id) return null;
    return { id: user.id };
  } catch {
    return null;
  }
}

/**
 * Require auth: returns 401 JSON response if not authenticated, otherwise returns null.
 */
export function requireAuthResponse(userId: string | null): Response | null {
  if (userId) return null;
  return jsonError("Unauthorized", 401);
}

/**
 * Verify the caller (profile id) is allowed to access the given profile id.
 * Allowed: callerId === profileId (own profile). Returns 403 Response or null.
 */
export function assertUserCanAccessProfile(callerId: string, profileId: string): Response | null {
  if (callerId === profileId) return null;
  return jsonError("Forbidden", 403);
}

/**
 * Verify the caller owns the client (is coach_id/trainer_id or is the client's user_id).
 * Uses public.clients. Returns 403 Response or null. Pass service-role supabase.
 */
export async function assertCoachOwnsClient(
  supabase: SupabaseClient,
  clientId: string,
  callerId: string
): Promise<Response | null> {
  const { data: row, error } = await supabase
    .from("clients")
    .select("user_id, coach_id, trainer_id")
    .eq("id", clientId)
    .maybeSingle();
  if (error || !row) return jsonError("Forbidden", 403);
  const r = row as Record<string, unknown>;
  const userId = r.user_id as string | null;
  const coachId = r.coach_id as string | null;
  const trainerId = r.trainer_id as string | null;
  if (userId === callerId || coachId === callerId || trainerId === callerId) return null;
  return jsonError("Forbidden", 403);
}

/**
 * Safe JSON error response. Never expose stack traces or internal details.
 */
export function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
