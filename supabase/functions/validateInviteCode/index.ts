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

type TrainerPreview = {
  id: string;
  name: string;
  niche: string;
  monthlyRate: number;
  coach_focus?: string | null;
};

type Result = {
  valid: boolean;
  error?: string;
  trainer_id?: string;
  coach_id?: string;
  trainer?: TrainerPreview;
};

/**
 * Single-word names that match Atlas trainer subscription tiers or generic placeholders.
 * Client join should show the coach's real packages (atlas_services) or coach_offers — not these.
 */
const PLATFORM_LIKE_SERVICE_NAMES = new Set([
  "basic",
  "pro",
  "elite",
  "standard",
  "premium",
]);

function normalizeServiceNameKey(name: unknown): string {
  return String(name ?? "").trim().toLowerCase();
}

/** Drop rows whose name is exactly a platform tier keyword (coaches should use "Basic coaching" etc. to keep a real package). */
function filterCoachClientServices(rows: unknown[] | null | undefined): Record<string, unknown>[] {
  const list = Array.isArray(rows) ? rows : [];
  return list.filter((row) => {
    const key = normalizeServiceNameKey((row as { name?: string }).name);
    return key.length > 0 && !PLATFORM_LIKE_SERVICE_NAMES.has(key);
  }) as Record<string, unknown>[];
}

type CoachOfferRow = {
  id: string;
  name?: string | null;
  price_monthly?: number | null;
  currency?: string | null;
  includes_training?: boolean | null;
  includes_nutrition?: boolean | null;
  includes_checkins?: boolean | null;
  includes_messaging?: boolean | null;
};

function coachOfferToJoinService(offer: CoachOfferRow): Record<string, unknown> {
  const parts: string[] = [];
  if (offer.includes_training) parts.push("Training");
  if (offer.includes_nutrition) parts.push("Nutrition planning");
  if (offer.includes_checkins) parts.push("Check-ins");
  if (offer.includes_messaging) parts.push("Messaging");
  const description =
    parts.length > 0 ? `Includes: ${parts.join(", ")}` : "Coaching package from your coach";
  const cur = String(offer.currency ?? "gbp").toLowerCase();
  const safeCur = cur === "gbp" || cur === "usd" || cur === "eur" ? cur : "gbp";
  const monthly = Math.max(0, Math.floor(Number(offer.price_monthly ?? 0)));
  return {
    id: offer.id,
    name: (offer.name && String(offer.name).trim()) || "Coaching package",
    description,
    price_amount: monthly * 100,
    currency: safeCur,
    interval: "month",
    active: true,
    /** FK for clients.selected_service_id — null when only coach_offers exists (no Stripe atlas_services row). */
    selected_service_id: null,
  };
}

function runFallback(supabase: ReturnType<typeof createClient>, normalized: string): Result | null {
  const { data: rows, error } = supabase
    .from("profiles")
    .select("id, display_name, role, coach_focus")
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
  const focusRaw = (row as { coach_focus?: string | null }).coach_focus;
  const focus = typeof focusRaw === "string" ? focusRaw.trim() : "";
  return {
    valid: true,
    trainer_id: id,
    coach_id: id,
    trainer: { id, name, niche: focus || "", monthlyRate: 10000, coach_focus: focus || null },
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
    const includeServices = body?.include_services === true || body?.include_plans === true;
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

    if (result.valid === true && result.trainer) {
      try {
        const pid = result.coach_id ?? result.trainer_id;
        if (pid) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("display_name, coach_focus")
            .eq("id", pid)
            .maybeSingle();
          const p = prof as Record<string, unknown> | null;
          if (p) {
            const t = result.trainer;
            const focus = typeof p.coach_focus === "string" ? (p.coach_focus as string).trim() : "";
            result.trainer = {
              ...t,
              name: (typeof p.display_name === "string" && p.display_name.trim() ? p.display_name : t.name) as string,
              niche: focus || t.niche,
              coach_focus: focus || null,
            };
          }
        }
      } catch (e) {
        console.warn("validateInviteCode enrich profile", e);
      }
    }

    const payload: Record<string, unknown> = { ...result };

    if (result.valid === true && includeServices) {
      const profileId = result.coach_id ?? result.trainer_id;
      if (profileId) {
        let servicesOut: Record<string, unknown>[] = [];

        const { data: coachRow } = await supabase.from("atlas_coaches").select("id").eq("user_id", profileId).maybeSingle();
        const atlasCoachId = coachRow && typeof (coachRow as { id?: string }).id === "string"
          ? (coachRow as { id: string }).id
          : null;

        if (atlasCoachId) {
          const { data: svc } = await supabase
            .from("atlas_services")
            .select("id, name, description, price_amount, currency, interval, active")
            .eq("coach_id", atlasCoachId)
            .eq("active", true)
            .order("created_at", { ascending: false });
          const filtered = filterCoachClientServices(svc ?? []);
          servicesOut = filtered.map((row) => ({
            ...row,
            selected_service_id: row.id,
          }));
        }

        if (servicesOut.length === 0) {
          const { data: offer } = await supabase
            .from("coach_offers")
            .select(
              "id, name, price_monthly, currency, includes_training, includes_nutrition, includes_checkins, includes_messaging",
            )
            .eq("coach_id", profileId)
            .maybeSingle();
          if (offer && typeof (offer as { id?: string }).id === "string") {
            servicesOut = [coachOfferToJoinService(offer as CoachOfferRow)];
          }
        }

        payload.services = servicesOut;
      } else {
        payload.services = [];
      }
    }

    if (result.valid === false) addDebug(payload, supabaseUrl);
    return json(payload);
  } catch (err) {
    console.error("validateInviteCode:", err);
    return json({ valid: false, error: (err as Error).message });
  }
});
