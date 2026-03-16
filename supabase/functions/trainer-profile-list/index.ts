/**
 * List trainer profile(s) for the authenticated user only. Caller can only list own profile (id from JWT).
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
    const userId = callerId;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, display_name, full_name, role, coach_focus, avatar_url, created_at")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr) {
      return jsonError("Request failed", 500);
    }
    if (!profile) {
      return new Response(JSON.stringify([]), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: marketplace } = await supabase
      .from("marketplace_coach_profiles")
      .select("display_name, headline, bio, specialties, monthly_price_from, is_listed")
      .eq("coach_id", userId)
      .maybeSingle();

    const merged = {
      id: (profile as Record<string, unknown>).id,
      user_id: (profile as Record<string, unknown>).id,
      display_name: (marketplace as Record<string, unknown>)?.display_name ?? (profile as Record<string, unknown>).display_name ?? (profile as Record<string, unknown>).full_name,
      full_name: (profile as Record<string, unknown>).full_name ?? (profile as Record<string, unknown>).display_name,
      headline: (marketplace as Record<string, unknown>)?.headline ?? null,
      bio: (marketplace as Record<string, unknown>)?.bio ?? null,
      specialties: (marketplace as Record<string, unknown>)?.specialties ?? [],
      monthly_rate: (marketplace as Record<string, unknown>)?.monthly_price_from ?? null,
      avatar_url: (profile as Record<string, unknown>).avatar_url ?? null,
      role: (profile as Record<string, unknown>).role,
      coach_focus: (profile as Record<string, unknown>).coach_focus,
      accepting_clients: (marketplace as Record<string, unknown>)?.is_listed ?? true,
      created_at: (profile as Record<string, unknown>).created_at,
    };
    return new Response(JSON.stringify([merged]), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("trainer-profile-list", e);
    return jsonError("Request failed", 500);
  }
});
