import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getAuthUserId, jsonError } from "../_shared/auth.ts";

const payloadSchema = z.object({
  coach_id: z.string().uuid(),
}).strict();

type InsightRow = {
  type: "weight_plateau" | "engagement_drop" | "habit_adherence" | "prep_risk" | "checkin_overdue" | "program_stall";
  severity: "low" | "medium" | "high";
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
};

type GraphContext = {
  events: Array<Record<string, unknown>>;
  trends: Array<Record<string, unknown>>;
  outcomes: Array<Record<string, unknown>>;
};

function asFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function buildGraphContext(clientId: string, supabase: ReturnType<typeof createClient>): Promise<GraphContext> {
  const [eventsRes, trendsRes, outcomesRes] = await Promise.all([
    supabase
      .from("performance_events")
      .select("id, event_type, event_data, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("progress_trends")
      .select("id, trend_type, trend_status, trend_value, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("client_outcomes")
      .select("id, coach_id, outcome_type, starting_weight, ending_weight, bodyfat_change, competition_placing, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return {
    events: !eventsRes.error && Array.isArray(eventsRes.data) ? eventsRes.data : [],
    trends: !trendsRes.error && Array.isArray(trendsRes.data) ? trendsRes.data : [],
    outcomes: !outcomesRes.error && Array.isArray(outcomesRes.data) ? outcomesRes.data : [],
  };
}

async function detectWeightPlateau(
  clientId: string,
  coachId: string,
  supabase: ReturnType<typeof createClient>,
  graph: GraphContext,
): Promise<InsightRow | null> {
  const weightTrend = graph.trends.find((t) => t.trend_type === "weight") || null;
  if (weightTrend && (weightTrend.trend_status === "improving" || weightTrend.trend_status === "stable")) return null;
  const status = String(weightTrend?.trend_status || "");
  const severity: InsightRow["severity"] = status === "declining" ? "high" : "medium";
  const goalContext =
    status === "declining"
      ? "Weight trend is moving away from the current goal."
      : "Weight trend appears flatter than expected for the current phase.";
  return {
    type: "weight_plateau",
    severity,
    title: "Weight trend needs review",
    message: `${goalContext} Review recent check-ins and adjust training or nutrition targets.`,
    metadata: {
      trend_status: weightTrend?.trend_status ?? null,
      trend_value: weightTrend?.trend_value ?? null,
      client_id: clientId,
      coach_id: coachId,
    },
  };
}

async function detectEngagementDrop(
  clientId: string,
  coachId: string,
  supabase: ReturnType<typeof createClient>,
  graph: GraphContext,
): Promise<InsightRow | null> {
  const now = Date.now();
  const activeWindowMs = 7 * 24 * 60 * 60 * 1000;
  const hasRecentEngagement = graph.events.some((evt) => {
    const ts = evt.created_at ? new Date(String(evt.created_at)).getTime() : NaN;
    if (Number.isNaN(ts) || now - ts > activeWindowMs) return false;
    const type = String(evt.event_type || "");
    return /checkin|message|habit|program/i.test(type);
  });
  const { data: signal } = await supabase
    .from("v_client_retention_signals")
    .select("engagement_score, risk_reason")
    .eq("client_id", clientId)
    .maybeSingle();
  const score = asFiniteNumber(signal?.engagement_score);
  if ((score != null && score >= 40 && !hasRecentEngagement) || (hasRecentEngagement && score != null && score >= 25)) {
    return null;
  }
  return {
    type: "engagement_drop",
    severity: score != null && score < 20 ? "high" : "medium",
    title: "Engagement dropping",
    message: "Recent engagement signals are low. Consider a proactive touchpoint and simpler next actions.",
    metadata: {
      engagement_score: score,
      risk_reason: signal?.risk_reason ?? [],
      recent_events_window_7d: hasRecentEngagement,
      client_id: clientId,
      coach_id: coachId,
    },
  };
}

async function detectHabitAdherenceIssue(
  clientId: string,
  coachId: string,
  supabase: ReturnType<typeof createClient>,
): Promise<InsightRow | null> {
  const { data: habits, error } = await supabase
    .from("v_client_habit_adherence")
    .select("habit_id, habit_title, adherence_last_7d, adherence_last_30d")
    .eq("client_id", clientId);
  if (error || !Array.isArray(habits) || habits.length === 0) return null;
  const lowHabits = habits.filter((h) => asFiniteNumber(h.adherence_last_7d) != null && Number(h.adherence_last_7d) < 50);
  if (!lowHabits.length) return null;
  return {
    type: "habit_adherence",
    severity: "medium",
    title: "Habit adherence needs support",
    message: "One or more key habits are below 50% adherence this week. Tighten one habit target first.",
    metadata: {
      low_habits: lowHabits.slice(0, 5),
      client_id: clientId,
      coach_id: coachId,
    },
  };
}

async function detectPrepRisk(
  clientId: string,
  coachId: string,
  supabase: ReturnType<typeof createClient>,
): Promise<InsightRow | null> {
  const { data: risk } = await supabase
    .from("v_client_retention_risk")
    .select("risk_band, reasons")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!risk || risk.risk_band === "healthy" || risk.risk_band === "watch") return null;
  return {
    type: "prep_risk",
    severity: risk.risk_band === "churn_risk" ? "high" : "medium",
    title: "Prep risk detected",
    message: "Retention and prep signals indicate elevated risk. Review check-ins, recovery, and communication cadence.",
    metadata: {
      risk_band: risk.risk_band,
      reasons: risk.reasons ?? [],
      client_id: clientId,
      coach_id: coachId,
    },
  };
}

async function detectCheckinOverdue(
  clientId: string,
  coachId: string,
  supabase: ReturnType<typeof createClient>,
): Promise<InsightRow | null> {
  const { data: signal } = await supabase
    .from("v_client_retention_signals")
    .select("days_since_last_checkin")
    .eq("client_id", clientId)
    .maybeSingle();
  const days = asFiniteNumber(signal?.days_since_last_checkin);
  if (days == null || days <= 7) return null;
  return {
    type: "checkin_overdue",
    severity: days > 14 ? "high" : "medium",
    title: "Check-in overdue",
    message: `Last check-in was ${Math.round(days)} days ago. A reminder could restore momentum this week.`,
    metadata: {
      days_since_last_checkin: Math.round(days),
      client_id: clientId,
      coach_id: coachId,
    },
  };
}

async function detectProgramStall(
  clientId: string,
  coachId: string,
  supabase: ReturnType<typeof createClient>,
  graph: GraphContext,
): Promise<InsightRow | null> {
  const complianceTrend = graph.trends.find((t) => t.trend_type === "program_compliance") || null;
  const engagementTrend = graph.trends.find((t) => t.trend_type === "engagement") || null;
  const status = String(complianceTrend?.trend_status || "");
  if (!["plateau", "declining"].includes(status)) return null;
  const severity: InsightRow["severity"] =
    status === "declining" || String(engagementTrend?.trend_status || "") === "declining"
      ? "high"
      : "medium";
  return {
    type: "program_stall",
    severity,
    title: "Program may be stalling",
    message: "Program compliance trend suggests stalled progress. Revisit load, volume, and recovery prescriptions.",
    metadata: {
      compliance_trend_status: complianceTrend?.trend_status ?? null,
      compliance_trend_value: complianceTrend?.trend_value ?? null,
      engagement_trend_status: engagementTrend?.trend_status ?? null,
      engagement_trend_value: engagementTrend?.trend_value ?? null,
      client_id: clientId,
      coach_id: coachId,
    },
  };
}

async function generateClientInsights(
  clientId: string,
  coachId: string,
  supabase: ReturnType<typeof createClient>,
): Promise<InsightRow[]> {
  const graph = await buildGraphContext(clientId, supabase);
  const detectors = [
    () => detectWeightPlateau(clientId, coachId, supabase, graph),
    () => detectEngagementDrop(clientId, coachId, supabase, graph),
    () => detectHabitAdherenceIssue(clientId, coachId, supabase),
    () => detectPrepRisk(clientId, coachId, supabase),
    () => detectCheckinOverdue(clientId, coachId, supabase),
    () => detectProgramStall(clientId, coachId, supabase, graph),
  ];
  const out: InsightRow[] = [];
  for (const run of detectors) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const insight = await run();
      if (insight) out.push(insight);
    } catch (err) {
      console.error("run-client-insights detector error", clientId, err);
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return jsonError("Method not allowed", 405);
  try {
    const callerId = await getAuthUserId(req);
    if (!callerId) return jsonError("Unauthorized", 401);

    const parsed = payloadSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return jsonError("Invalid request payload", 400);
    const coachId = parsed.data.coach_id;
    if (callerId !== coachId) return jsonError("Forbidden", 403);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: clients, error: clientsErr } = await supabase
      .from("clients")
      .select("id")
      .eq("coach_id", coachId);
    if (clientsErr) return jsonError("Could not load clients", 500);

    let processed = 0;
    let insights = 0;
    for (const c of clients || []) {
      const clientId = String(c.id || "");
      if (!clientId) continue;
      processed += 1;
      // eslint-disable-next-line no-await-in-loop
      const generated = await generateClientInsights(clientId, coachId, supabase);
      if (!generated.length) continue;
      const rows = generated.map((g) => ({
        client_id: clientId,
        coach_id: coachId,
        type: g.type,
        insight_type: g.type,
        severity: g.severity,
        message: g.message,
        description: g.message,
        title: g.title,
        metadata: g.metadata ?? {},
        is_resolved: false,
      }));
      // eslint-disable-next-line no-await-in-loop
      const { error: insertErr } = await supabase.from("coaching_insights").insert(rows);
      if (insertErr) {
        console.error("run-client-insights insert error", clientId, insertErr);
        continue;
      }
      insights += rows.length;
    }

    return new Response(
      JSON.stringify({ processed, insights }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("run-client-insights", err);
    return jsonError("Request failed", 500);
  }
});
