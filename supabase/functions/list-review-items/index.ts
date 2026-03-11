// List review items for a coach (payment_overdue, intake_required, etc.)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { TABLE } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const userId = body.user_id ?? body.coach_id;
    const coachId = body.coach_id;
    const status = body.status ?? "active";

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let targetCoachId = coachId;
    if (!targetCoachId && userId) {
      const { data: coach } = await supabase.from(TABLE.coaches).select("id").eq("user_id", userId).single();
      targetCoachId = coach?.id ?? null;
    }
    if (!targetCoachId) return new Response(JSON.stringify({ error: "coach_id or user_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    let q = supabase.from(TABLE.review_items).select("id, coach_id, client_id, type, status, priority, dedupe_key, metadata_json, created_at").eq("coach_id", targetCoachId);
    if (status) q = q.eq("status", status);
    const { data: rawItems, error } = await q.order("priority", { ascending: false }).order("created_at", { ascending: false });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
