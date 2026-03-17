/**
 * Validate coach invite code. Tries DB RPC validate_invite_code(p_code);
 * if RPC is missing or fails, falls back to direct profiles lookup.
 * Always returns 200 with { valid, error?, trainer_id?, coach_id?, trainer?, _debug? }.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function addDebug(payload: Record<string, unknown>, supabaseUrl: string): void {
  try {
    const u = new URL(supabaseUrl);
    payload._debug = { project: u.hostname.replace(".supabase.co", "") };
  } catch (_) {}
}

type Result = {
  valid: boolean;
  error?: string;
  trainer_id?: string;
  coach_id?: string;
  trainer?: { id: string; name: string; niche: string; monthlyRate: number };
};

function runFallback(supabase: ReturnType<typeof createClient>, normalized: string): Result | null {
  const { data: rows, error } = supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("referral_code", normalized)
    .limit(1);
  if (error) {
    console.error("validateInviteCode fallback error:", error);
    return null;
  }
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) return { valid: false };
  const role = (row as { role?: string }).role;
  if (role !== "coach" && role !== "trainer") {
    return { valid: false, error: "Code is not for a coach" };
  }
  const id = (row as { id: string }).id;
  const name = (row as { display_name?: string }).display_name ?? "Coach";
  return {
    valid: true,
    trainer_id: id,
    coach_id: id,
    trainer: { id, name, niche: "", monthlyRate: 10000 },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return json({ valid: false, error: "Server not configured" });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const raw = typeof body?.code === "string" ? body.code : "";
    const normalized = normalize(raw);
    if (!normalized) {
      return json({ valid: false, error: "Invalid code" });
    }

    let result: Result | null = null;

    const { data: rpcData, error: rpcError } = await supabase.rpc("validate_invite_code", { p_code: normalized });
    if (!rpcError && rpcData != null && typeof (rpcData as { valid?: unknown }).valid === "boolean") {
      result = rpcData as Result;
    } else {
      if (rpcError) console.error("validateInviteCode RPC error (using fallback):", rpcError.message);
      result = runFallback(supabase, normalized);
    }

    if (!result) {
      const payload: Record<string, unknown> = { valid: false, error: "Lookup failed" };
      addDebug(payload, supabaseUrl);
      return json(payload);
    }

    const payload: Record<string, unknown> = { ...result };
    if (result.valid === false) addDebug(payload, supabaseUrl);
    return json(payload);
  } catch (err) {
    console.error("validateInviteCode:", err);
    return json({ valid: false, error: (err as Error).message });
  }
});
