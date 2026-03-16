// List services for the authenticated coach only (JWT).
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

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: coach } = await supabase.from(TABLE.coaches).select("id").eq("user_id", callerId).single();
    const targetCoachId = (coach as { id?: string } | null)?.id ?? null;
    if (!targetCoachId) return jsonError("Coach not found", 404);

    const { data: services, error } = await supabase.from(TABLE.services).select("id, coach_id, name, description, price_amount, currency, interval, stripe_price_id, active, created_at, updated_at").eq("coach_id", targetCoachId).order("created_at", { ascending: false });

    if (error) return jsonError("Request failed", 500);
    return new Response(JSON.stringify({ services: services ?? [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("list-services", e);
    return jsonError("Request failed", 500);
  }
});
