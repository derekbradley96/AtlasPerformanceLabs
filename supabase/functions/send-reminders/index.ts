// Scheduled job: evaluate reminder triggers and insert into public.notifications for clients.
// Uses service role. Schedule via Supabase Dashboard → Scheduled Triggers (e.g. daily 08:00 and 18:00 UTC).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const TRIGGER_COPY: Record<string, { title: string; message: string }> = {
  workout_due: {
    title: "Workout due today",
    message: "You have a workout scheduled for today. Log it when you're done to keep your progress on track.",
  },
  workout_evening_reminder: {
    title: "Workout still waiting",
    message: "Workout still waiting. Let's keep the streak going.",
  },
  checkin_due: {
    title: "Check-in due",
    message: "Your check-in is due today.",
  },
  habit_missing: {
    title: "Habit check-in",
    message: "Don't forget to log your habits for today.",
  },
  prep_pose_check_due: {
    title: "Pose check due",
    message: "Your weekly pose check is due. Submit your photos when you're ready.",
  },
  billing_due: {
    title: "Payment due",
    message: "Your payment is due or overdue. Please update your payment method to continue your coaching.",
  },
  supplement_morning_reminder: {
    title: "Morning supplements",
    message: "Don't forget to take your morning supplements and log them in the app.",
  },
  supplement_evening_reminder: {
    title: "Evening supplements",
    message: "Time to take your evening supplements. Log them when you're done.",
  },
  supplement_missed_reminder: {
    title: "Supplements not logged",
    message: "You had supplements due today that haven't been logged yet. Tap to log them.",
  },
};

/** Monday of the current week in UTC (for consistent cron behavior). */
function getWeekStartUTC(d: Date): string {
  const utcDay = d.getUTCDay();
  const daysToMonday = utcDay === 0 ? 6 : utcDay - 1;
  const monday = new Date(d);
  monday.setUTCDate(monday.getUTCDate() - daysToMonday);
  return monday.toISOString().slice(0, 10);
}

function getTodayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const today = getTodayISO();
    const weekStart = getWeekStartUTC(now);
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1 Mon .. 7 Sun (ISODOW)
    const isEvening = now.getUTCHours() >= 18; // 6pm UTC: send "still waiting" reminder
    const nextDay = new Date(now);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const nextDayISO = nextDay.toISOString().slice(0, 10);

    type Pair = { user_id: string; trigger_type: string };
    const toSend: Pair[] = [];

    // Load all clients with user_id once for lookups
    const { data: clientRows } = await supabase.from("clients").select("id, user_id");
    const clientById = new Map((clientRows ?? []).map((c) => [c.id, c]));

    // 1) checkin_due: clients with user_id and no checkin for current week
    const allClients = clientRows ?? [];
    const { data: checkinsThisWeek } = await supabase.from("checkins").select("client_id").eq("week_start", weekStart);
    const hasCheckin = new Set((checkinsThisWeek ?? []).map((r) => r.client_id));
    for (const c of allClients) {
      if (c.user_id && !hasCheckin.has(c.id)) toSend.push({ user_id: c.user_id, trigger_type: "checkin_due" });
    }

    // 2) prep_pose_check_due: clients with active contest_prep and no pose_check this week
    const { data: prepClients } = await supabase
      .from("contest_preps")
      .select("client_id")
      .eq("is_active", true);
    const prepClientIds = new Set((prepClients ?? []).map((r) => r.client_id));
    const { data: poseThisWeek } = await supabase.from("pose_checks").select("client_id").eq("week_start", weekStart);
    const hasPose = new Set((poseThisWeek ?? []).map((r) => r.client_id));
    for (const clientId of prepClientIds) {
      if (hasPose.has(clientId)) continue;
      const c = clientById.get(clientId);
      if (c?.user_id) toSend.push({ user_id: c.user_id, trigger_type: "prep_pose_check_due" });
    }

    // 3) billing_due: clients with billing_status = 'overdue' or next_due_date <= today
    const { data: billingClients } = await supabase
      .from("clients")
      .select("id, user_id")
      .not("user_id", "is", null)
      .or("billing_status.eq.overdue,next_due_date.lte." + today);
    for (const c of billingClients ?? []) {
      if (c.user_id) toSend.push({ user_id: c.user_id, trigger_type: "billing_due" });
    }

    // 4) habit_missing: clients with at least one habit and at least one habit with no log for today
    const { data: habits } = await supabase.from("client_habits").select("id, client_id");
    const clientHabits = new Map<string, string[]>();
    for (const h of habits ?? []) {
      const list = clientHabits.get(h.client_id) ?? [];
      list.push(h.id);
      clientHabits.set(h.client_id, list);
    }
    const { data: logsToday } = await supabase.from("habit_logs").select("habit_id").eq("log_date", today);
    const loggedHabitIds = new Set((logsToday ?? []).map((r) => r.habit_id));
    for (const [clientId, habitIds] of clientHabits) {
      const missing = habitIds.some((id) => !loggedHabitIds.has(id));
      if (missing) {
        const c = clientById.get(clientId);
        if (c?.user_id) toSend.push({ user_id: c.user_id, trigger_type: "habit_missing" });
      }
    }

    // 5) workout_due: clients with a program day scheduled today and no completed session for it today
    const { data: assignments } = await supabase
      .from("program_block_assignments")
      .select("client_id, program_block_id, start_date")
      .eq("is_active", true);
    const { data: blocks } = await supabase.from("program_blocks").select("id, client_id, total_weeks");
    const blockMap = new Map((blocks ?? []).map((b) => [b.id, b]));
    const weekStartDate = new Date(weekStart + "T12:00:00Z");
    for (const a of assignments ?? []) {
      const block = blockMap.get(a.program_block_id);
      if (!block || block.client_id !== a.client_id) continue;
      const start = new Date(a.start_date);
      const weeksDiff = Math.floor((weekStartDate.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
      if (weeksDiff < 0 || weeksDiff >= block.total_weeks) continue;
      const weekNumber = weeksDiff + 1;
      const { data: weeks } = await supabase
        .from("program_weeks")
        .select("id")
        .eq("block_id", a.program_block_id)
        .eq("week_number", weekNumber)
        .limit(1);
      const weekId = weeks?.[0]?.id;
      if (!weekId) continue;
      const { data: days } = await supabase
        .from("program_days")
        .select("id")
        .eq("week_id", weekId)
        .eq("day_number", dayOfWeek)
        .limit(1);
      const programDayId = days?.[0]?.id;
      if (!programDayId) continue;
      const { data: completed } = await supabase
        .from("workout_sessions")
        .select("id")
        .eq("client_id", a.client_id)
        .eq("program_day_id", programDayId)
        .eq("status", "completed")
        .gte("completed_at", today + "T00:00:00Z")
        .lt("completed_at", nextDayISO + "T00:00:00Z")
        .limit(1);
      if ((completed ?? []).length > 0) continue;
      const c = clientById.get(a.client_id);
      if (c?.user_id) {
        toSend.push({
          user_id: c.user_id,
          trigger_type: isEvening ? "workout_evening_reminder" : "workout_due",
        });
      }
    }

    // 6) Supplement reminders: morning / evening / missed (by UTC hour)
    const hour = now.getUTCHours();
    const isMorningWindow = hour >= 6 && hour < 12;
    const isEveningWindow = hour >= 17 && hour < 21;
    const isMissedWindow = hour >= 21 || hour < 6;

    function isMorningTiming(t: string | null): boolean {
      if (!t || !String(t).trim()) return true;
      const lower = String(t).toLowerCase();
      if (/evening|night|pm\b|dinner|bed|afternoon/.test(lower)) return false;
      if (/morning|am\b|breakfast|wake|before noon/.test(lower)) return true;
      return true;
    }
    function isEveningTiming(t: string | null): boolean {
      if (!t || !String(t).trim()) return true;
      const lower = String(t).toLowerCase();
      if (/morning|am\b|breakfast|wake/.test(lower)) return false;
      if (/evening|night|pm\b|dinner|bed|afternoon/.test(lower)) return true;
      return true;
    }

    const { data: allClientSupplements } = await supabase
      .from("client_supplements")
      .select("id, client_id, timing");
    const { data: logsTodaySupp } = await supabase
      .from("supplement_logs")
      .select("client_supplement_id")
      .eq("log_date", today)
      .eq("taken", true);
    const supplementLoggedToday = new Set((logsTodaySupp ?? []).map((r) => r.client_supplement_id));

    const clientSuppsByClient = new Map<string, { id: string; timing: string | null }[]>();
    for (const row of allClientSupplements ?? []) {
      const list = clientSuppsByClient.get(row.client_id) ?? [];
      list.push({ id: row.id, timing: row.timing ?? null });
      clientSuppsByClient.set(row.client_id, list);
    }

    for (const [clientId, supps] of clientSuppsByClient) {
      const c = clientById.get(clientId);
      if (!c?.user_id) continue;
      const morningDue = supps.filter((s) => isMorningTiming(s.timing) && !supplementLoggedToday.has(s.id));
      const eveningDue = supps.filter((s) => isEveningTiming(s.timing) && !supplementLoggedToday.has(s.id));
      const anyDue = supps.filter((s) => !supplementLoggedToday.has(s.id));

      if (isMorningWindow && morningDue.length > 0) toSend.push({ user_id: c.user_id, trigger_type: "supplement_morning_reminder" });
      if (isEveningWindow && eveningDue.length > 0) toSend.push({ user_id: c.user_id, trigger_type: "supplement_evening_reminder" });
      if (isMissedWindow && anyDue.length > 0) toSend.push({ user_id: c.user_id, trigger_type: "supplement_missed_reminder" });
    }

    // Already-sent today: (user_id, type) set
    const { data: existing } = await supabase
      .from("notifications")
      .select("user_id, type")
      .gte("created_at", today + "T00:00:00Z");
    const sentToday = new Set((existing ?? []).map((r) => `${r.user_id}:${r.type}`));

    let inserted = 0;
    const byTrigger: Record<string, number> = {};
    for (const { user_id, trigger_type } of toSend) {
      if (sentToday.has(`${user_id}:${trigger_type}`)) continue;
      const copy = TRIGGER_COPY[trigger_type] ?? { title: "Reminder", message: "You have an action due." };
      const { error } = await supabase.from("notifications").insert({
        user_id,
        type: trigger_type,
        title: copy.title,
        message: copy.message,
        is_read: false,
      });
      if (!error) {
        inserted += 1;
        sentToday.add(`${user_id}:${trigger_type}`);
        byTrigger[trigger_type] = (byTrigger[trigger_type] ?? 0) + 1;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        evaluated: toSend.length,
        inserted,
        by_trigger: byTrigger,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("send-reminders", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
