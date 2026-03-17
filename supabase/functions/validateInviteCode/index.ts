/**
 * Validate coach invite code. Calls DB RPC validate_invite_code(p_code)
 * so lookup is done in SQL (case-insensitive, no PostgREST filter quirks).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Server not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const code = typeof body?.code === "string" ? body.code : "";
    const { data, error } = await supabase.rpc("validate_invite_code", { p_code: code });

    if (error) {
      console.error("validateInviteCode RPC error:", error);
      return new Response(JSON.stringify({ valid: false, error: "Lookup failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = data as { valid?: boolean; error?: string } | null;
    if (!result || typeof result.valid !== "boolean") {
      const payload: Record<string, unknown> = { valid: false };
      if (req.headers.get("X-Debug-Invite") === "1") {
        try {
          const u = new URL(supabaseUrl);
          payload._debug = { project: u.hostname.replace(".supabase.co", "") };
        } catch (_) {}
      }
      return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const payload: Record<string, unknown> = { ...result };
    if (result.valid === false) {
      try {
        const u = new URL(supabaseUrl);
        payload._debug = { project: u.hostname.replace(".supabase.co", "") };
      } catch (_) {}
    }
    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("validateInviteCode:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
