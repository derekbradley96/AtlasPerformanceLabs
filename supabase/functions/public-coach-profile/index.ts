/**
 * Public coach profile by slug (referral_code). Returns profile, marketplace bio, and public result stories.
 * No auth required; used for /coach/:slug page.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkEdgeRateLimit } from "../_shared/publicSecurity.ts";

const payloadSchema = z.object({
  slug: z.string().trim().min(1).max(80),
}).strict();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server not configured" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawBody = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const parsed = payloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid request payload" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }
    const slug = parsed.data.slug.trim();

    const rate = await checkEdgeRateLimit({
      req,
      scope: "public-coach-profile",
      keyPart: slug.toLowerCase(),
      maxHits: 60,
      windowSeconds: 60,
    });
    if (!rate.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many requests" }),
        {
          status: 429,
          headers: {
            ...getCorsHeaders(req),
            "Content-Type": "application/json",
            "Retry-After": String(rate.retryAfterSeconds),
          },
        }
      );
    }

    const normalized = slug.trim().toLowerCase();

    // Resolve coach by referral_code (profiles) or by coach_referral_codes.code
    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, display_name, full_name, coach_focus, referral_code, avatar_url, taking_clients, plan_tier, brand_name, brand_logo_url, brand_accent_colour, onboarding_headline, onboarding_message, onboarding_bullets",
      )
      .ilike("referral_code", normalized)
      .limit(1);

    if (profileError) {
      console.error("public-coach-profile profiles error:", profileError);
      return new Response(
        JSON.stringify({ error: "Lookup failed" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const profile = Array.isArray(profileRows) && profileRows.length > 0 ? profileRows[0] : null;
    if (!profile) {
      // Fallback: try coach_referral_codes by code
      const { data: codeRows } = await supabase
        .from("coach_referral_codes")
        .select("coach_id")
        .ilike("code", normalized)
        .eq("is_active", true)
        .limit(1);
      const refRow = Array.isArray(codeRows) && codeRows.length > 0 ? codeRows[0] : null;
      if (!refRow || !(refRow as { coach_id?: string }).coach_id) {
        return new Response(
          JSON.stringify({ error: "Coach not found", coach: null, stories: [] }),
          { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
      const coachId = (refRow as { coach_id: string }).coach_id;
      const { data: pRows } = await supabase
        .from("profiles")
        .select(
          "id, display_name, full_name, coach_focus, referral_code, avatar_url, taking_clients, plan_tier, brand_name, brand_logo_url, brand_accent_colour, onboarding_headline, onboarding_message, onboarding_bullets",
        )
        .eq("id", coachId)
        .limit(1);
      const p = Array.isArray(pRows) && pRows.length > 0 ? pRows[0] : null;
      if (!p) {
        return new Response(
          JSON.stringify({ error: "Coach not found", coach: null, stories: [] }),
          { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
      return await buildResponse(
        supabase,
        p as {
          id: string;
          display_name?: string;
          full_name?: string;
          coach_focus?: string;
          referral_code?: string;
          avatar_url?: string | null;
        },
      );
    }

    return await buildResponse(
      supabase,
      profile as {
        id: string;
        display_name?: string;
        full_name?: string;
        coach_focus?: string;
        referral_code?: string;
        avatar_url?: string | null;
      },
    );
  } catch (err) {
    console.error("public-coach-profile:", err);
    return new Response(
      JSON.stringify({ error: "Request failed" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});

async function buildResponse(
  supabase: ReturnType<typeof createClient>,
  profile: {
    id: string;
    display_name?: string;
    full_name?: string;
    coach_focus?: string;
    referral_code?: string;
    avatar_url?: string | null;
    taking_clients?: boolean | null;
  },
) {
  const coachId = profile.id;
  const takingClients = (profile as { taking_clients?: boolean | null }).taking_clients !== false;

  const { data: marketplaceRows } = await supabase
    .from("marketplace_coach_profiles")
    .select("display_name, headline, bio, coaching_focus, specialties")
    .eq("coach_id", coachId)
    .limit(1);
  const marketplace = Array.isArray(marketplaceRows) && marketplaceRows.length > 0 ? marketplaceRows[0] : null;

  const planTierRaw = String((profile as { plan_tier?: string | null }).plan_tier ?? "").trim().toLowerCase();
  const planTier = planTierRaw === "elite" || planTierRaw === "pro" || planTierRaw === "basic" ? planTierRaw : "basic";

  const coachName =
    (marketplace as { display_name?: string } | null)?.display_name ||
    (profile as { full_name?: string }).full_name ||
    (profile as { display_name?: string }).display_name ||
    "Coach";
  const shortBio =
    (marketplace as { headline?: string } | null)?.headline ||
    (marketplace as { bio?: string } | null)?.bio ||
    null;
  const bio = (marketplace as { bio?: string } | null)?.bio || null;
  const coachFocus = (profile as { coach_focus?: string }).coach_focus || null;
  const specialties = (marketplace as { specialties?: string[] } | null)?.specialties ?? [];
  const coachingFocusArr = (marketplace as { coaching_focus?: string[] } | null)?.coaching_focus ?? [];

  const { data: storyRows, error: storyError } = await supabase
    .from("client_result_stories")
    .select("id, story_type, title, summary, before_image_path, after_image_path, created_at")
    .eq("coach_id", coachId)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  if (storyError) {
    console.error("public-coach-profile stories error:", storyError);
  }
  const stories = (Array.isArray(storyRows) ? storyRows : []).map((s) => ({
    id: (s as { id: string }).id,
    story_type: (s as { story_type: string }).story_type,
    title: (s as { title: string }).title,
    summary: (s as { summary?: string }).summary ?? null,
    before_image_path: (s as { before_image_path?: string }).before_image_path ?? null,
    after_image_path: (s as { after_image_path?: string }).after_image_path ?? null,
    created_at: (s as { created_at?: string }).created_at ?? null,
    metrics: [] as { metric_key: string; metric_label: string; metric_value: string; sort_order: number }[],
  }));

  const { data: offerRow } = await supabase
    .from("coach_offers")
    .select("name, price_monthly, currency, includes_training, includes_nutrition, includes_checkins, includes_messaging")
    .eq("coach_id", coachId)
    .maybeSingle();

  let clientsCoachedCount: number | null = null;
  const { count: clientCount, error: clientCountError } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .or(`coach_id.eq.${coachId},trainer_id.eq.${coachId}`);
  if (!clientCountError && typeof clientCount === "number") {
    clientsCoachedCount = clientCount;
  }

  const storyIds = stories.map((s) => s.id);
  if (storyIds.length > 0) {
    const { data: metricRows } = await supabase
      .from("result_story_metrics")
      .select("story_id, metric_key, metric_label, metric_value, sort_order")
      .in("story_id", storyIds)
      .order("sort_order", { ascending: true });
    const metrics = Array.isArray(metricRows) ? metricRows : [];
    for (const m of metrics) {
      const story = stories.find((s) => s.id === (m as { story_id: string }).story_id);
      if (story) {
        story.metrics.push({
          metric_key: (m as { metric_key: string }).metric_key,
          metric_label: (m as { metric_label: string }).metric_label,
          metric_value: (m as { metric_value: string }).metric_value,
          sort_order: (m as { sort_order: number }).sort_order ?? 0,
        });
      }
    }
  }

  const offer = offerRow && typeof offerRow === "object"
    ? {
      name: String((offerRow as { name?: string }).name ?? "Online coaching"),
      price_monthly: Math.max(1, Math.floor(Number((offerRow as { price_monthly?: number }).price_monthly) || 100)),
      currency: String((offerRow as { currency?: string }).currency ?? "GBP"),
      includes_training: (offerRow as { includes_training?: boolean }).includes_training !== false,
      includes_nutrition: (offerRow as { includes_nutrition?: boolean }).includes_nutrition !== false,
      includes_checkins: (offerRow as { includes_checkins?: boolean }).includes_checkins !== false,
      includes_messaging: (offerRow as { includes_messaging?: boolean }).includes_messaging !== false,
    }
    : null;

  let showcase_stats: {
    avg_transformation_kg: number | null;
    avg_response_hours: number | null;
  } = {
    avg_transformation_kg: null,
    avg_response_hours: null,
  };

  const { data: rosterRows } = await supabase
    .from("clients")
    .select("id")
    .or(`coach_id.eq.${coachId},trainer_id.eq.${coachId}`);
  const rosterIds = (Array.isArray(rosterRows) ? rosterRows : [])
    .map((r) => (r as { id: string }).id)
    .filter(Boolean);

  if (rosterIds.length > 0) {
    const { data: reviewRows } = await supabase
      .from("checkins")
      .select("submitted_at, reviewed_at, created_at")
      .in("client_id", rosterIds)
      .not("reviewed_at", "is", null);
    const latencies: number[] = [];
    for (const row of reviewRows ?? []) {
      const r0 = row as { submitted_at?: string | null; reviewed_at?: string | null; created_at?: string | null };
      const s = new Date(r0.submitted_at || r0.created_at || 0).getTime();
      const r = new Date(r0.reviewed_at || 0).getTime();
      if (Number.isFinite(s) && Number.isFinite(r) && r > s) latencies.push((r - s) / 3600000);
    }
    if (latencies.length > 0) {
      showcase_stats = {
        ...showcase_stats,
        avg_response_hours: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      };
    }

    const windowMs = 84 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - windowMs;
    const { data: weightRows } = await supabase
      .from("checkins")
      .select("client_id, weight, submitted_at, created_at")
      .in("client_id", rosterIds)
      .not("weight", "is", null);
    const byClient = new Map<string, { t: number; w: number }[]>();
    for (const row of weightRows ?? []) {
      const r = row as { client_id?: string; weight?: unknown; submitted_at?: string | null; created_at?: string | null };
      const cid = String(r.client_id || "");
      const w = Number(r.weight);
      if (!cid || !Number.isFinite(w)) continue;
      const t = new Date(r.submitted_at || r.created_at || 0).getTime();
      if (!Number.isFinite(t)) continue;
      const list = byClient.get(cid) ?? [];
      list.push({ t, w });
      byClient.set(cid, list);
    }
    const deltas: number[] = [];
    for (const [, list] of byClient) {
      const sorted = list.filter((x) => x.t >= cutoff).sort((a, b) => a.t - b.t);
      if (sorted.length < 2) continue;
      const first = sorted[0].w;
      const last = sorted[sorted.length - 1].w;
      deltas.push(Math.abs(last - first));
    }
    if (deltas.length > 0) {
      showcase_stats = {
        ...showcase_stats,
        avg_transformation_kg: deltas.reduce((a, b) => a + b, 0) / deltas.length,
      };
    }
  }

  let services: Array<{
    id: string;
    name: string;
    description: string | null;
    price_amount: number;
    currency: string;
    interval: string;
  }> = [];

  const { data: atlasCoach } = await supabase
    .from("atlas_coaches")
    .select("id")
    .eq("user_id", String(coachId))
    .maybeSingle();
  const atlasCoachId = (atlasCoach as { id?: string } | null)?.id ?? null;
  if (atlasCoachId) {
    const { data: svcRows } = await supabase
      .from("atlas_services")
      .select("id, name, description, price_amount, currency, interval, active")
      .eq("coach_id", atlasCoachId)
      .eq("active", true)
      .order("price_amount", { ascending: true });
    services = (Array.isArray(svcRows) ? svcRows : []).map((s) => ({
      id: String((s as { id: string }).id),
      name: String((s as { name?: string }).name ?? ""),
      description: (s as { description?: string | null }).description ?? null,
      price_amount: Math.max(0, Math.floor(Number((s as { price_amount?: number }).price_amount) || 0)),
      currency: String((s as { currency?: string }).currency ?? "gbp"),
      interval: String((s as { interval?: string }).interval ?? "month"),
    }));
  }

  const bulletsRaw = (profile as { onboarding_bullets?: unknown }).onboarding_bullets;
  const onboardingBullets = Array.isArray(bulletsRaw)
    ? (bulletsRaw as unknown[]).map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 3)
    : [];

  const coach = {
    id: coachId,
    name: coachName,
    short_bio: shortBio,
    bio: bio || shortBio,
    coach_focus: coachFocus,
    slug: (profile as { referral_code?: string }).referral_code ?? null,
    specialties: specialties.length > 0 ? specialties : coachingFocusArr,
    avatar_url: (profile as { avatar_url?: string | null }).avatar_url ?? null,
    taking_clients: takingClients,
    plan_tier: planTier,
    brand_name: (profile as { brand_name?: string | null }).brand_name ?? null,
    brand_logo_url: (profile as { brand_logo_url?: string | null }).brand_logo_url ?? null,
    brand_accent_colour: (profile as { brand_accent_colour?: string | null }).brand_accent_colour ?? null,
    onboarding_headline: (profile as { onboarding_headline?: string | null }).onboarding_headline ?? null,
    onboarding_message: (profile as { onboarding_message?: string | null }).onboarding_message ?? null,
    onboarding_bullets: onboardingBullets,
  };

  const referralCode = (profile as { referral_code?: string }).referral_code ?? null;
  if (referralCode) {
    await supabase.from("coach_referral_events").insert({
      coach_id: coachId,
      code: referralCode,
      event_type: "public_profile_viewed",
      metadata: {},
    });
  }

  return new Response(
    JSON.stringify({
      coach,
      stories,
      offer,
      clients_coached_count: clientsCoachedCount,
      showcase_stats,
      services,
    }),
    { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
  );
}
