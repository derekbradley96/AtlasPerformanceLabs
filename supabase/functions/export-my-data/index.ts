// Export my data (GDPR right of access / portability): gather every row the
// platform holds about the authenticated user and return it as one JSON
// document. Pairs with delete-account — the table coverage here mirrors what
// deletion removes (DB rows via the same identity keys, plus the storage
// folders delete-account purges, listed as paths).
//
// Identity model (matches delete-account and RLS policies):
//   - auth uid  == profiles.id == every profile_id / user_id / coach_id /
//     trainer_id / owner_profile_id column
//   - clients.user_id = uid links the caller to their client rows; client_id
//     columns reference clients.id
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getAuthUserId } from "../_shared/auth.ts";

// Per-table filter columns. `user` columns match the auth uid directly,
// `client` columns match the caller's clients.id rows, `coach` columns match
// the auth uid when the caller has coach-side data. A table listed in more
// than one group is fetched per group and deduped, so a coach exporting also
// gets rows where they are the subject (and vice versa).
type TableSpec = { user?: string[]; client?: string[]; coach?: string[] };

const TABLES: Record<string, TableSpec> = {
  account_deletion_feedback: { user: ["user_id"] },
  adjustment_suggestions: { client: ["client_id"], coach: ["coach_id"] },
  atlas_clients: { coach: ["coach_id"] },
  atlas_coaches: { user: ["user_id"] },
  atlas_invoice_fees: { coach: ["coach_id"] },
  atlas_leads: { coach: ["coach_id"] },
  atlas_payments: { client: ["client_id"], coach: ["coach_id"] },
  atlas_retention_review_items: { client: ["client_id"], coach: ["coach_id"] },
  atlas_review_items: { client: ["client_id"], coach: ["coach_id"] },
  atlas_services: { coach: ["coach_id"] },
  beta_feedback: { user: ["profile_id"] },
  beta_support_requests: { user: ["profile_id"] },
  checkin_call_requests: { client: ["client_id"], coach: ["coach_id"] },
  checkin_templates: { coach: ["coach_id", "trainer_id"] },
  checkins: { client: ["client_id"], coach: ["trainer_id"] },
  client_billing: { client: ["client_id"] },
  client_coach_removals: { client: ["client_id"], coach: ["coach_id"] },
  client_compliance: { client: ["client_id"], coach: ["coach_id"] },
  client_engagement_events: { client: ["client_id"], coach: ["coach_id"] },
  client_flags: { client: ["client_id"], coach: ["coach_id"] },
  client_habit_logs: { client: ["client_id"] },
  client_habits: { client: ["client_id"], coach: ["coach_id"] },
  client_milestones: { client: ["client_id"], coach: ["coach_id"] },
  client_momentum_scores: { client: ["client_id"] },
  client_payments: { client: ["client_id"], coach: ["coach_id"] },
  client_phases: { client: ["client_id"], coach: ["coach_id"] },
  client_prep_precision: { client: ["client_id"] },
  client_prep_precision_daily: { client: ["client_id"] },
  client_result_stories: { client: ["client_id"], coach: ["coach_id"] },
  client_state: { client: ["client_id"], coach: ["coach_id"] },
  client_subscriptions: { client: ["client_id"], coach: ["coach_id"] },
  client_supplements: { client: ["client_id"] },
  client_weight_logs: { client: ["client_id"] },
  clients: { user: ["user_id"], coach: ["coach_id", "trainer_id"] },
  closeouts: { coach: ["trainer_id"] },
  coach_billing_state: { coach: ["coach_id"] },
  coach_client_notes: { client: ["client_id"], coach: ["coach_id"] },
  coach_inquiries: { coach: ["coach_id"] },
  coach_marketplace_profiles: { coach: ["coach_id"] },
  coach_plan_subscriptions: { coach: ["coach_id"] },
  coach_public_enquiries: { coach: ["coach_id"] },
  coach_referral_codes: { coach: ["coach_id"] },
  coach_referral_events: { coach: ["coach_id"] },
  coach_reviews: { coach: ["coach_id"] },
  coach_saved_terms: { coach: ["coach_id"] },
  coach_sessions: { client: ["client_id"], coach: ["coach_id"] },
  coach_subscription_tiers: { coach: ["coach_id"] },
  coaching_insights: { client: ["client_id"], coach: ["coach_id"] },
  contest_preps: { client: ["client_id"] },
  device_push_tokens: { user: ["user_id"] },
  device_tokens: { user: ["profile_id"] },
  exercise_favorites: { user: ["user_id"] },
  exercise_performance: { client: ["client_id"] },
  exercise_usage: { user: ["user_id"], coach: ["coach_id"] },
  group_messages: { user: ["sender_user_id"] },
  group_room_members: { user: ["user_id"] },
  group_rooms: { coach: ["coach_id"] },
  invoices: { client: ["client_id"], coach: ["trainer_id"] },
  leads: { coach: ["coach_id", "trainer_id"] },
  lifts: { client: ["client_id"] },
  marketplace_coach_profiles: { coach: ["coach_id"] },
  meal_logs: { user: ["profile_id"], client: ["client_id"] },
  message_threads: { client: ["client_id"], coach: ["coach_id"] },
  methodology_packages: { coach: ["coach_id"] },
  milestones: { client: ["client_id"] },
  notification_preferences: { user: ["profile_id"] },
  notifications: { user: ["profile_id"] },
  nutrition_adjustments: { user: ["profile_id"], client: ["client_id"], coach: ["coach_id"] },
  nutrition_daily_adherence: { client: ["client_id"] },
  nutrition_plans: { client: ["client_id"], coach: ["trainer_id"] },
  organisation_members: { user: ["profile_id"] },
  organisations: { user: ["owner_profile_id"] },
  peak_week_checkins: { client: ["client_id"] },
  peak_week_day_status: { client: ["client_id"] },
  peak_week_plans: { client: ["client_id"] },
  peak_week_protocols: { client: ["client_id"] },
  peak_week_templates: { coach: ["coach_id"] },
  peak_weeks: { client: ["client_id"], coach: ["coach_id"] },
  pending_coach_messages: { client: ["client_id"], coach: ["coach_id"] },
  personal: { user: ["user_id"] },
  personal_checkins: { user: ["user_id"] },
  personal_contest_preps: { user: ["profile_id"] },
  personal_nutrition_adherence: { user: ["profile_id"] },
  personal_prep_precision: { user: ["user_id"] },
  personal_prep_precision_daily: { user: ["user_id"] },
  personal_program_assignments: { user: ["profile_id"] },
  platform_usage_events: { user: ["user_id"] },
  pose_checks: { client: ["client_id"] },
  pose_conditioning_notes: { coach: ["coach_id"] },
  pose_scores: { coach: ["coach_id"] },
  pose_self_assessments: { user: ["profile_id"] },
  posing_practice_logs: { user: ["profile_id"], client: ["client_id"] },
  posing_submissions: { client: ["client_id"] },
  prep_outcomes: { client: ["client_id"] },
  prep_peak_overrides: { client: ["client_id"] },
  profiles: { user: ["id"] },
  program_adjustments: { user: ["profile_id"], client: ["client_id"], coach: ["coach_id"] },
  program_assignments: { client: ["client_id"] },
  program_block_assignments: { client: ["client_id"] },
  program_blocks: { user: ["owner_profile_id"], client: ["client_id"], coach: ["coach_id"] },
  programs: { coach: ["trainer_id"] },
  progress_photos: { user: ["profile_id"], client: ["client_id"], coach: ["coach_id"] },
  readiness_checkins: { user: ["profile_id"], client: ["client_id"] },
  retention_habit_daily: { user: ["profile_id"], client: ["client_id"] },
  review_queue_dismissals: { client: ["client_id"], coach: ["coach_id"] },
  review_queue_items: { client: ["client_id"], coach: ["coach_id"] },
  security_audit_logs: { user: ["profile_id"] },
  shared_milestones: { client: ["client_id"] },
  stage_readiness_scores: { client: ["client_id"] },
  training_adjustment_recommendations: { client: ["client_id"], coach: ["coach_id"] },
  upgrade_trigger_events: { coach: ["coach_id"] },
  user_feedback: { user: ["profile_id"] },
  workout_logs: { client: ["client_id"] },
  workout_sessions: { user: ["profile_id"], client: ["client_id"] },
};

// Storage folders per identity — same layout delete-account purges.
const USER_STORAGE: Array<[string, (uid: string) => string]> = [
  ["profile_images", (uid) => uid],
  ["marketplace_coach_media", (uid) => uid],
  ["progress_photos", (uid) => `personal/${uid}`],
];
const CLIENT_STORAGE: Array<[string, (clientRowId: string) => string]> = [
  ["progress_photos", (id) => id],
  ["checkin_photos", (id) => id],
  ["checkin_photos", (id) => `peak_week/${id}`],
  ["pose_check_photos", (id) => id],
];

const PAGE_SIZE = 1000;
const MAX_PAGES = 25; // 25k rows per table+filter — flags `truncated` beyond that
const IN_CHUNK = 100;
const CONCURRENCY = 6;

async function fetchAllRows(
  supabase: SupabaseClient,
  table: string,
  column: string,
  values: string[],
): Promise<{ rows: Record<string, unknown>[]; truncated: boolean }> {
  const rows: Record<string, unknown>[] = [];
  let truncated = false;
  for (let c = 0; c < values.length; c += IN_CHUNK) {
    const chunk = values.slice(c, c + IN_CHUNK);
    for (let page = 0; page < MAX_PAGES; page++) {
      const from = page * PAGE_SIZE;
      const query = supabase.from(table).select("*").range(from, from + PAGE_SIZE - 1);
      const { data, error } = chunk.length === 1
        ? await query.eq(column, chunk[0])
        : await query.in(column, chunk);
      if (error) throw new Error(`${table}.${column}: ${error.message}`);
      rows.push(...((data ?? []) as Record<string, unknown>[]));
      if ((data ?? []).length < PAGE_SIZE) break;
      if (page === MAX_PAGES - 1) truncated = true;
    }
  }
  return { rows, truncated };
}

function dedupe(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Set<string>();
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    const key = typeof row.id === "string" || typeof row.id === "number"
      ? `id:${row.id}`
      : JSON.stringify(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function listStorageFolder(
  supabase: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const paths: string[] = [];
  const walk = async (folder: string, depth: number) => {
    if (depth > 6) return;
    for (let page = 0; page < 20; page++) {
      const { data: entries, error } = await supabase.storage
        .from(bucket)
        .list(folder, { limit: 100, offset: page * 100 });
      if (error || !entries || entries.length === 0) return;
      for (const e of entries as Array<{ id: string | null; name: string }>) {
        if (e.id) paths.push(`${folder}/${e.name}`);
        else await walk(`${folder}/${e.name}`, depth + 1);
      }
      if (entries.length < 100) return;
    }
  };
  await walk(prefix, 0);
  return paths;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const userId = await getAuthUserId(req);
    if (!userId) return json({ ok: false, error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRole) {
      return json({ ok: false, error: "Server not configured" }, 500);
    }
    const supabase = createClient(supabaseUrl, serviceRole);

    // Identities: own client rows; coach side is active if any coach-keyed
    // clients/roster rows exist (cheap probe on clients).
    const { data: ownClientRows, error: clientErr } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", userId);
    if (clientErr) return json({ ok: false, error: "Could not resolve identity" }, 500);
    const clientRowIds = (ownClientRows ?? [])
      .map((r: { id: string | null }) => r.id)
      .filter(Boolean) as string[];

    const { data: authUser } = await supabase.auth.admin.getUserById(userId);

    const data: Record<string, Record<string, unknown>[]> = {};
    const truncatedTables: string[] = [];
    const errors: Record<string, string> = {};

    const jobs = Object.entries(TABLES).map(([table, spec]) => async () => {
      try {
        const collected: Record<string, unknown>[] = [];
        let truncated = false;
        const filters: Array<[string, string[]]> = [];
        for (const col of spec.user ?? []) filters.push([col, [userId]]);
        for (const col of spec.coach ?? []) filters.push([col, [userId]]);
        if (clientRowIds.length > 0) {
          for (const col of spec.client ?? []) filters.push([col, clientRowIds]);
        }
        for (const [col, values] of filters) {
          const res = await fetchAllRows(supabase, table, col, values);
          collected.push(...res.rows);
          truncated = truncated || res.truncated;
        }
        const rows = dedupe(collected);
        if (rows.length > 0) data[table] = rows;
        if (truncated) truncatedTables.push(table);
      } catch (err) {
        errors[table] = err instanceof Error ? err.message : String(err);
      }
    });

    // Message bodies hang off threads, not off a user column.
    jobs.push(async () => {
      try {
        const threadRows = data["message_threads"] ?? (await (async () => {
          const byCoach = await fetchAllRows(supabase, "message_threads", "coach_id", [userId]);
          const byClient = clientRowIds.length > 0
            ? await fetchAllRows(supabase, "message_threads", "client_id", clientRowIds)
            : { rows: [], truncated: false };
          return dedupe([...byCoach.rows, ...byClient.rows]);
        })());
        const threadIds = threadRows
          .map((t) => t.id)
          .filter((id): id is string => typeof id === "string");
        if (threadIds.length === 0) return;
        const res = await fetchAllRows(supabase, "message_messages", "thread_id", threadIds);
        if (res.rows.length > 0) data["message_messages"] = res.rows;
        if (res.truncated) truncatedTables.push("message_messages");
      } catch (err) {
        errors["message_messages"] = err instanceof Error ? err.message : String(err);
      }
    });

    // Run table jobs with bounded concurrency, message job last (it can reuse
    // the fetched threads).
    const messageJob = jobs.pop()!;
    for (let i = 0; i < jobs.length; i += CONCURRENCY) {
      await Promise.all(jobs.slice(i, i + CONCURRENCY).map((job) => job()));
    }
    await messageJob();

    // Storage: list file paths (media itself is viewable in-app; paths prove
    // what is held and mirror what delete-account removes).
    const storageFiles: Record<string, string[]> = {};
    const addFiles = (bucket: string, paths: string[]) => {
      if (paths.length === 0) return;
      storageFiles[bucket] = [...(storageFiles[bucket] ?? []), ...paths];
    };
    for (const [bucket, prefixFor] of USER_STORAGE) {
      addFiles(bucket, await listStorageFolder(supabase, bucket, prefixFor(userId)));
    }
    for (const clientRowId of clientRowIds) {
      for (const [bucket, prefixFor] of CLIENT_STORAGE) {
        addFiles(bucket, await listStorageFolder(supabase, bucket, prefixFor(clientRowId)));
      }
    }

    return json({
      ok: true,
      export_version: 1,
      generated_at: new Date().toISOString(),
      user_id: userId,
      account: authUser?.user
        ? {
          email: authUser.user.email ?? null,
          created_at: authUser.user.created_at ?? null,
          last_sign_in_at: authUser.user.last_sign_in_at ?? null,
        }
        : null,
      data,
      storage_files: storageFiles,
      truncated_tables: truncatedTables,
      table_errors: errors,
      notes:
        "All rows the platform holds keyed to your account, grouped by table. storage_files lists your uploaded media paths; the files are viewable in the app. Empty tables are omitted.",
    });
  } catch (err) {
    console.error("export-my-data unexpected", err);
    return json({ ok: false, error: "Unexpected server error" }, 500);
  }
});
