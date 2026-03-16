/**
 * List coaches available for discovery (marketplace). Uses marketplace_coach_profiles + profiles.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: marketplaceRows, error: mErr } = await supabase
      .from("marketplace_coach_profiles")
      .select("coach_id, display_name, headline, bio, specialties, monthly_price_from, is_listed")
      .eq("is_listed", true);

    if (mErr) {
      return new Response(JSON.stringify([]), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const list = Array.isArray(marketplaceRows) ? marketplaceRows : [];
    if (list.length === 0) {
      return new Response(JSON.stringify([]), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const coachIds = list.map((r: Record<string, unknown>) => r.coach_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, full_name, avatar_url, created_at")
      .in("id", coachIds);

    const profileMap = new Map<string, Record<string, unknown>>();
    for (const p of Array.isArray(profiles) ? profiles : []) {
      profileMap.set((p as Record<string, unknown>).id as string, p as Record<string, unknown>);
    }

    const out = list.map((m: Record<string, unknown>) => {
      const profile = profileMap.get(m.coach_id as string) ?? {};
      return {
        id: m.coach_id,
        user_id: m.coach_id,
        display_name: m.display_name ?? profile.display_name ?? profile.full_name,
        headline: m.headline,
        bio: m.bio,
        specialties: m.specialties ?? [],
        monthly_rate: m.monthly_price_from,
        avatar_url: profile.avatar_url,
        accepting_clients: m.is_listed ?? true,
        created_date: profile.created_at,
        created_at: profile.created_at,
      };
    });
    return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("trainer-marketplace-list", e);
    return new Response(JSON.stringify([]), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
