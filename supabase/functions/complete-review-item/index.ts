// Mark a review item as done. Caller must be the coach who owns the item.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { TABLE } from "../_shared/supabase.ts";
import { getAuthUserId, requireAuthResponse, jsonError } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const callerId = await getAuthUserId(req);
    const authErr = requireAuthResponse(callerId);
    if (authErr) return authErr;

    const body = await req.json().catch(() => ({}));
    const { item_id, status = "done" } = body;
    if (!item_id) return jsonError("item_id required", 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: item } = await supabase.from(TABLE.review_items).select("coach_id").eq("id", item_id).maybeSingle();
    if (!item) return jsonError("Item not found", 404);
    const { data: coach } = await supabase.from(TABLE.coaches).select("id").eq("user_id", callerId).maybeSingle();
    const coachId = (coach as { id?: string } | null)?.id ?? null;
    if (coachId !== (item as { coach_id?: string }).coach_id) return jsonError("Forbidden", 403);

    const { error } = await supabase.from(TABLE.review_items).update({ status, updated_at: new Date().toISOString() }).eq("id", item_id);

    if (error) return jsonError("Request failed", 500);
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("complete-review-item", e);
    return jsonError("Request failed", 500);
  }
});
