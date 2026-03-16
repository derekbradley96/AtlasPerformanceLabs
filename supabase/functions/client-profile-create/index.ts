/**
 * Create a client profile (link a user to a coach). Caller must be the coach (coach_id from body must equal JWT).
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
    const userId = body.user_id ?? body.client_user_id;
    const coachId = body.coach_id ?? body.trainer_id;
    if (!userId) return jsonError("user_id required", 400);
    if (!coachId || coachId !== callerId) return jsonError("coach_id must match authenticated user", 403);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const row: Record<string, unknown> = {
      user_id: userId,
      coach_id: coachId,
      trainer_id: coachId,
      name: body.name ?? null,
      full_name: body.full_name ?? body.name ?? null,
      billing_status: body.billing_status ?? body.subscription_status ?? "active",
    };
    if (body.phase != null) row.phase = body.phase;
    if (body.monthly_fee != null) row.monthly_fee = body.monthly_fee;
    if (body.next_due_date != null) row.next_due_date = body.next_due_date;

    const { data, error } = await supabase.from("clients").insert(row).select("id, user_id, coach_id, trainer_id, name, full_name, billing_status").single();

    if (error) {
      console.error("client-profile-create", error);
      return jsonError("Request failed", 500);
    }
    const out = { ...data, subscription_status: (data as Record<string, unknown>).billing_status ?? "active" };
    return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("client-profile-create", e);
    return jsonError("Request failed", 500);
  }
});
