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

function getProjectRef(supabaseUrl: string): string | null {
  try {
    const u = new URL(supabaseUrl);
    return u.hostname.replace(".supabase.co", "") || null;
  } catch (_) {
    return null;
  }
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
  console.log("validateInviteCode request:", req.method);
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("validateInviteCode: missing SUPABASE_URL or SERVICE_ROLE_KEY");
      return json({ valid: false, error: "Server not configured" });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const raw = typeof body?.code === "string" ? body.code : "";
    const normalized = normalize(raw);
    console.log("validateInviteCode code length:", raw.length, "normalized length:", normalized.length);
    if (!normalized) {
      return json({ valid: false, error: "Invalid code" });
    }

    let result: Result | null = null;
    let usedFallback = false;

    const { data: rpcData, error: rpcError } = await supabase.rpc("validate_invite_code", { p_code: normalized });
    const rpcResult = (Array.isArray(rpcData) && rpcData[0] != null ? rpcData[0] : rpcData) as Result | null;
    if (!rpcError && rpcResult != null && typeof rpcResult.valid === "boolean") {
      result = rpcResult;
      console.log("validateInviteCode RPC ok, valid:", result.valid);
    } else {
      usedFallback = true;
      if (rpcError) console.error("validateInviteCode RPC error (using fallback):", rpcError.message, rpcError);
      result = runFallback(supabase, normalized);
      console.log("validateInviteCode fallback result:", result?.valid ?? null);
    }

    if (!result) {
      const payload: Record<string, unknown> = {
        valid: false,
        error: "Lookup failed",
        _debug: { project: getProjectRef(supabaseUrl), rpcFailed: usedFallback },
      };
      return json(payload);
    }

    const payload: Record<string, unknown> = { ...result };
    if (result.valid === false) {
      (payload as Record<string, unknown>)._debug = {
        project: getProjectRef(supabaseUrl),
        rpcFailed: usedFallback,
      };
    }
    return json(payload);
  } catch (err) {
    console.error("validateInviteCode:", err);
    return json({ valid: false, error: (err as Error).message });
  }
});
