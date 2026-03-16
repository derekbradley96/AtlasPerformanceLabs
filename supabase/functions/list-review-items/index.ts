// List review items for the authenticated coach only (JWT).
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

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const status = body.status ?? "active";

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: coach } = await supabase.from(TABLE.coaches).select("id").eq("user_id", callerId).single();
    const targetCoachId = (coach as { id?: string } | null)?.id ?? null;
    if (!targetCoachId) return jsonError("Coach not found", 404);

    let q = supabase.from(TABLE.review_items).select("id, coach_id, client_id, type, status, priority, dedupe_key, metadata_json, created_at").eq("coach_id", targetCoachId);
    if (status) q = q.eq("status", status);
    const { data: rawItems, error } = await q.order("priority", { ascending: false }).order("created_at", { ascending: false });
    if (error) return jsonError("Request failed", 500);
    const items = rawItems ?? [];
    const clientIds = [...new Set(items.map((i) => i.client_id).filter(Boolean))];
    let clientNames: Record<string, string> = {};
    if (clientIds.length > 0) {
      const { data: clients } = await supabase.from(TABLE.clients).select("id, name").in("id", clientIds);
      for (const c of clients ?? []) clientNames[c.id] = c.name ?? c.email ?? "Client";
    }
    const itemsWithNames = items.map((i) => ({ ...i, client_name: i.client_id ? clientNames[i.client_id] ?? "Client" : null }));

    return new Response(JSON.stringify({ items: itemsWithNames }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("list-review-items", e);
    return jsonError("Request failed", 500);
  }
});
