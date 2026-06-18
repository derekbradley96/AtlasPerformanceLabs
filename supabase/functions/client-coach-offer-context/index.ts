/**
 * Authenticated client: returns coach + selected atlas_services package for payment / resume UI.
 * JWT must match clients.user_id.
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

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: row, error: cErr } = await supabase
      .from("clients")
      .select("id, coach_id, trainer_id, billing_status, selected_service_id, name")
      .eq("user_id", callerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cErr) return jsonError("Request failed", 500);
    if (!row?.id) {
      return new Response(JSON.stringify({ ok: false, error: "no_client_row" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const coachProfileId = (row as { coach_id?: string }).coach_id ?? (row as { trainer_id?: string }).trainer_id;
    let coachName = "Coach";
    let coachAvatar: string | null = null;
    if (coachProfileId) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, full_name, avatar_url")
        .eq("id", coachProfileId)
        .maybeSingle();
      if (prof) {
        const p = prof as { display_name?: string; full_name?: string; avatar_url?: string | null };
        coachName = (p.display_name || p.full_name || coachName).trim() || coachName;
        coachAvatar = p.avatar_url ?? null;
      }
    }

    const sid = (row as { selected_service_id?: string | null }).selected_service_id ?? null;
    let service: Record<string, unknown> | null = null;
    if (sid) {
      const { data: svc } = await supabase
        .from("atlas_services")
        .select("id, name, description, price_amount, currency, interval, stripe_price_id, active")
        .eq("id", sid)
        .maybeSingle();
      if (svc) service = svc as Record<string, unknown>;
    }

    const billing = String((row as { billing_status?: string }).billing_status ?? "active");

    return new Response(
      JSON.stringify({
        ok: true,
        clients_row_id: (row as { id: string }).id,
        billing_status: billing,
        coach: { id: coachProfileId ?? null, display_name: coachName, avatar_url: coachAvatar },
        service,
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("client-coach-offer-context", e);
    return jsonError("Request failed", 500);
  }
});
