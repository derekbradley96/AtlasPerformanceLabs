/**
 * List client profile(s) for the authenticated user only (clients where user_id = caller).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getAuthUserId, requireAuthResponse, jsonError } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  try {
    const callerId = await getAuthUserId(req);
    const authErr = requireAuthResponse(callerId);
    if (authErr) return authErr;
    const userId = callerId;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: rows, error } = await supabase
      .from("clients")
      .select("id, user_id, coach_id, trainer_id, name, phase, phase_started_at, baseline_weight, gym_name, created_at, monthly_fee, next_due_date, billing_status, lifecycle_stage, membership_type")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return jsonError("Request failed", 500);
    }
    const list = Array.isArray(rows) ? rows : [];

    // Prioritize client rows with an active assigned program block so app surfaces the right profile first.
    const clientIds = list.map((r: Record<string, unknown>) => String(r.id ?? '')).filter(Boolean);
    const assignmentClientIdSet = new Set<string>();
    if (clientIds.length > 0) {
      const { data: assignedRows } = await supabase
        .from("program_block_assignments")
        .select("client_id")
        .in("client_id", clientIds)
        .eq("is_active", true);
      for (const row of assignedRows ?? []) {
        const cid = (row as Record<string, unknown>).client_id;
        if (typeof cid === "string" && cid) assignmentClientIdSet.add(cid);
      }
    }

    const prioritized = [...list].sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const aId = String(a.id ?? "");
      const bId = String(b.id ?? "");
      const aAssigned = assignmentClientIdSet.has(aId) ? 1 : 0;
      const bAssigned = assignmentClientIdSet.has(bId) ? 1 : 0;
      if (aAssigned !== bAssigned) return bAssigned - aAssigned;
      return 0;
    });

    // Map to legacy-friendly shape: subscription_status from billing_status
    const out = prioritized.map((r: Record<string, unknown>) => ({
      ...r,
      full_name: r.name ?? null,
      subscription_status: r.billing_status ?? "active",
    }));
    return new Response(JSON.stringify(out), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  } catch (e) {
    console.error("client-profile-list", e);
    return jsonError("Request failed", 500);
  }
});
