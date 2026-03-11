// List services for a coach (by user_id or coach_id)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { TABLE } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const userId = body.user_id ?? body.coach_id;
    const coachId = body.coach_id;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let targetCoachId = coachId;
    if (!targetCoachId && userId) {
      const { data: coach } = await supabase.from(TABLE.coaches).select("id").eq("user_id", userId).single();
      targetCoachId = coach?.id ?? null;
    }
    if (!targetCoachId) return new Response(JSON.stringify({ error: "coach_id or user_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: services, error } = await supabase.from(TABLE.services).select("id, coach_id, name, description, price_amount, currency, interval, stripe_price_id, active, created_at, updated_at").eq("coach_id", targetCoachId).order("created_at", { ascending: false });

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ services: services ?? [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("list-services", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
