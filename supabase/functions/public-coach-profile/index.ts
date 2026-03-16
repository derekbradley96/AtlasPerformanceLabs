/**
 * Public coach profile by slug (referral_code). Returns profile, marketplace bio, and public result stories.
 * No auth required; used for /coach/:slug page.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
    if (!slug) {
      return new Response(
        JSON.stringify({ error: "slug required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalized = slug.trim().toLowerCase();

    // Resolve coach by referral_code (profiles) or by coach_referral_codes.code
    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name, full_name, coach_focus, referral_code")
      .ilike("referral_code", normalized)
      .limit(1);

    if (profileError) {
      console.error("public-coach-profile profiles error:", profileError);
      return new Response(
        JSON.stringify({ error: "Lookup failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const coachId = (refRow as { coach_id: string }).coach_id;
      const { data: pRows } = await supabase
        .from("profiles")
        .select("id, display_name, full_name, coach_focus, referral_code")
        .eq("id", coachId)
        .limit(1);
      const p = Array.isArray(pRows) && pRows.length > 0 ? pRows[0] : null;
      if (!p) {
        return new Response(
          JSON.stringify({ error: "Coach not found", coach: null, stories: [] }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return await buildResponse(supabase, p as { id: string; display_name?: string; full_name?: string; coach_focus?: string; referral_code?: string });
    }

    return await buildResponse(supabase, profile as { id: string; display_name?: string; full_name?: string; coach_focus?: string; referral_code?: string });
  } catch (err) {
    console.error("public-coach-profile:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function buildResponse(
  supabase: ReturnType<typeof createClient>,
  profile: { id: string; display_name?: string; full_name?: string; coach_focus?: string; referral_code?: string }
) {
  const coachId = profile.id;

  const { data: marketplaceRows } = await supabase
    .from("marketplace_coach_profiles")
    .select("display_name, headline, bio, coaching_focus, specialties")
    .eq("coach_id", coachId)
    .limit(1);
  const marketplace = Array.isArray(marketplaceRows) && marketplaceRows.length > 0 ? marketplaceRows[0] : null;

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

  const coach = {
    id: coachId,
    name: coachName,
    short_bio: shortBio,
    bio: bio || shortBio,
    coach_focus: coachFocus,
    slug: (profile as { referral_code?: string }).referral_code ?? null,
    specialties: specialties.length > 0 ? specialties : coachingFocusArr,
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
    JSON.stringify({ coach, stories }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
