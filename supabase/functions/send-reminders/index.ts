// Scheduled job: evaluate reminder triggers and insert into public.notifications for clients.
// Uses service role.
// Recommended schedule: every 30 minutes
// Supabase Dashboard -> Edge Functions -> Schedules
// Cron: */30 * * * *

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { sendPushToProfile } from "../_shared/fcm.ts";
import { TRIGGER_PREF_KEY, loadNotificationPrefs, isNotificationAllowed } from "../_shared/notificationPrefs.ts";

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
  habit_due: {
    title: "Habit reminder",
    message: "Don't forget today's habits.",
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

/** Add days to a YYYY-MM-DD date string, return YYYY-MM-DD. */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function normalizeCurrencyAmount(value: unknown): string {
  const amount = Number(value) || 0;
  return `£${Math.round(amount)}`;
}

/**
 * Coaches enter schedule_time in a plain time picker (their local wall clock).
 * Evaluate schedules in Europe/London so BST doesn't shift every reminder by
 * an hour; per-coach timezones would need a column on checkin_templates.
 */
function getLondonClock(now: Date): { dayOfWeek: number; currentTime: string } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    dayOfWeek: dayMap[get("weekday")] ?? now.getUTCDay(),
    currentTime: `${get("hour") || "00"}:${get("minute") || "00"}`,
  };
}

async function handleScheduledCheckinReminders(
  supabase: SupabaseClient,
  now: Date
): Promise<number> {
  const { dayOfWeek, currentTime } = getLondonClock(now); // 0=Sun 6=Sat, "HH:MM"

  const { data: templates } = await supabase
    .from('checkin_templates')
    .select(`
      id, schedule_day_of_week, schedule_time,
      reminder_advance_minutes,
      clients!clients_checkin_template_id_fkey(
        id, user_id, full_name
      )
    `)
    .eq('schedule_day_of_week', dayOfWeek)
    .eq('is_active', true)
    .not('schedule_time', 'is', null);

  if (!templates?.length) return 0;

  const allUserIds = templates.flatMap((t) =>
    (((t as { clients?: Array<{ user_id?: string | null }> }).clients) ?? [])
      .map((c) => c?.user_id)
      .filter(Boolean) as string[]
  );
  const prefs = await loadNotificationPrefs(supabase, allUserIds);

  let sent = 0;
  for (const template of templates) {
    const scheduleTime = String((template as { schedule_time?: string | null })?.schedule_time || '');
    if (!scheduleTime) continue;

    const [h, m] = scheduleTime.split(':').map(Number);
    const scheduleMinutes = (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
    const reminderAdvanceMinutes = Number((template as { reminder_advance_minutes?: number | null })?.reminder_advance_minutes ?? 60) || 60;
    const reminderMinutes = scheduleMinutes - reminderAdvanceMinutes;
    const reminderHour = Math.floor(reminderMinutes / 60);
    const reminderMin = reminderMinutes % 60;
    const reminderTime =
      `${String(reminderHour).padStart(2, '0')}:${String(reminderMin).padStart(2, '0')}`;

    const [ch, cm] = currentTime.split(':').map(Number);
    const currentMinutes = (Number.isFinite(ch) ? ch : 0) * 60 + (Number.isFinite(cm) ? cm : 0);
    const diff = Math.abs(currentMinutes - reminderMinutes);
    if (diff > 30) continue;

    const assignedClients = ((template as { clients?: Array<{ id?: string; user_id?: string | null }> }).clients ?? []);
    for (const client of assignedClients) {
      if (!client?.user_id || !client?.id) continue;
      if (!isNotificationAllowed(prefs, client.user_id, "checkins")) continue;
      const weekStart = getWeekStartUTC(now);
      const { data: existing } = await supabase
        .from('checkins')
        .select('id')
        .eq('client_id', client.id)
        .gte('submitted_at', `${weekStart}T00:00:00Z`)
        .limit(1);
      if (existing?.length) continue;

      await supabase.from('notifications').insert({
        profile_id: client.user_id,
        type: 'checkin_due',
        title: 'Check-in reminder',
        message: `Your check-in opens in ${reminderAdvanceMinutes} minutes.`,
        is_read: false,
        category: 'coaching',
        created_at: new Date().toISOString(),
        data: {
          type: 'checkin_due',
          deep_link: '/submit-checkin',
          reminder_time: reminderTime,
          template_id: (template as { id?: string }).id ?? null,
        },
      });
      await sendPushToProfile(supabase, {
        profileId: client.user_id,
        title: 'Check-in reminder',
        body: `Your check-in opens in ${reminderAdvanceMinutes} minutes.`,
        data: { type: 'checkin_due', deep_link: '/submit-checkin' },
      });
      sent++;
    }
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  // Set CRON_SECRET in Supabase Edge Function secrets.
  // In Supabase Dashboard > Edge Functions > Schedules, set the HTTP header:
  // Authorization: Bearer <your-CRON_SECRET>
  // Validate cron caller secret
  if (req.method !== "OPTIONS") {
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const today = getTodayISO();
    const weekStart = getWeekStartUTC(now);
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1 Mon .. 7 Sun (ISODOW)
    const isEvening = Number(getLondonClock(now).currentTime.slice(0, 2)) >= 18; // 6pm London: send "still waiting" reminder
    const nextDay = new Date(now);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const nextDayISO = nextDay.toISOString().slice(0, 10);
    const sevenDaysAgoStartIso = `${addDays(today, -7)}T00:00:00Z`;
    const sevenDaysAgoEndIso = `${addDays(today, -6)}T00:00:00Z`;
    const fourWeeksAgo = new Date(now);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const fourWeeksAgoMinus1 = new Date(fourWeeksAgo);
    fourWeeksAgoMinus1.setDate(fourWeeksAgoMinus1.getDate() - 1);

    type Pair = {
      client_id?: string;
      user_id: string;
      trigger_type: string;
      title?: string;
      message?: string;
      data?: Record<string, unknown>;
      dedupe_key?: string;
    };
    const toSend: Pair[] = [];
    const scheduledCheckinInserted = await handleScheduledCheckinReminders(supabase, now);

    // Load all clients with user_id once for lookups (coach ids needed for coach-side automations)
    const { data: clientRows } = await supabase
      .from("clients")
      .select("id, user_id, coach_id, trainer_id, name, full_name");
    const clientById = new Map((clientRows ?? []).map((c) => [c.id, c]));

    // 1) checkin_due (legacy fallback): clients with user_id and no checkin for current week
    const allClients = clientRows ?? [];
    const { data: checkinsThisWeek } = await supabase.from("checkins").select("client_id").eq("week_start", weekStart);
    const hasCheckin = new Set((checkinsThisWeek ?? []).map((r) => r.client_id));
    for (const c of allClients) {
      if (!c.user_id || hasCheckin.has(c.id)) continue;
      let customMessage = TRIGGER_COPY.checkin_due.message;
      try {
        const { data: recentCheckin } = await supabase
          .from("checkins")
          .select("weight, submitted_at, created_at")
          .eq("client_id", c.id)
          .order("submitted_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();
        const lastWeight = Number(recentCheckin?.weight);
        if (Number.isFinite(lastWeight) && lastWeight > 0) {
          customMessage = `Your check-in is due. Last week: ${lastWeight.toFixed(1)}kg. How are you tracking this week?`;
        }
      } catch (_) {}
      toSend.push({
        user_id: c.user_id,
        client_id: c.id,
        trigger_type: "checkin_due",
        message: customMessage,
        data: { type: "checkin_due", client_id: c.id, deep_link: "/submit-checkin" },
      });
    }

    // 1b) Review prompt: 7 days after a coach relationship ended.
    const { data: removals7d } = await supabase
      .from("client_coach_removals")
      .select("id, client_id, coach_id, created_at")
      .gte("created_at", sevenDaysAgoStartIso)
      .lt("created_at", sevenDaysAgoEndIso);
    if (Array.isArray(removals7d) && removals7d.length > 0) {
      const coachIds = [...new Set(removals7d.map((r) => r.coach_id).filter(Boolean))];
      const { data: coachProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, display_name")
        .in("id", coachIds);
      const coachNameById = new Map<string, string>();
      for (const c of coachProfiles ?? []) {
        const id = String((c as { id?: string }).id || "");
        const name = String((c as { full_name?: string | null; display_name?: string | null }).full_name || (c as { display_name?: string | null }).display_name || "your coach");
        if (id) coachNameById.set(id, name);
      }

      for (const removal of removals7d) {
        const client = clientById.get(removal.client_id);
        if (!client?.user_id) continue;
        const coachName = coachNameById.get(String(removal.coach_id)) || "your coach";
        toSend.push({
          user_id: client.user_id,
          client_id: removal.client_id,
          trigger_type: "coach_review_prompt",
          title: "How was your coaching experience?",
          message: `How was your experience with ${coachName}? Leave a review to help other athletes.`,
          data: {
            type: "coach_review_prompt",
            coach_id: removal.coach_id,
            client_id: removal.client_id,
            deep_link: `/review/coach/${removal.coach_id}`,
          },
          dedupe_key: `coach_review_prompt:${removal.id}`,
        });
      }
    }

    // 1c) Review prompt: around 4 weeks into an active coach relationship (28 days +/- 1 day).
    const { data: eligibleClients } = await supabase
      .from("clients")
      .select("id, user_id, coach_id, trainer_id, created_at")
      .gte("created_at", fourWeeksAgoMinus1.toISOString())
      .lte("created_at", fourWeeksAgo.toISOString())
      .not("coach_id", "is", null);
    if (Array.isArray(eligibleClients) && eligibleClients.length > 0) {
      const coachIds = [
        ...new Set(
          eligibleClients
            .map((c) => String(c.coach_id || c.trainer_id || "").trim())
            .filter(Boolean)
        ),
      ];
      const { data: coachProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, display_name")
        .in("id", coachIds);
      const coachNameById = new Map<string, string>();
      for (const c of coachProfiles ?? []) {
        const id = String((c as { id?: string }).id || "");
        const name = String(
          (c as { full_name?: string | null; display_name?: string | null }).full_name ||
            (c as { display_name?: string | null }).display_name ||
            "your coach"
        );
        if (id) coachNameById.set(id, name);
      }

      for (const client of eligibleClients) {
        if (!client?.user_id) continue;
        const coachId = String(client.coach_id || client.trainer_id || "").trim();
        if (!coachId) continue;
        const { data: existingReview } = await supabase
          .from("coach_reviews")
          .select("id")
          .eq("reviewer_client_id", client.id)
          .eq("coach_id", coachId)
          .maybeSingle();
        if (existingReview) continue;

        const coachName = coachNameById.get(coachId) || "your coach";
        toSend.push({
          user_id: client.user_id,
          client_id: client.id,
          trigger_type: "review_prompt_4_weeks",
          title: "How is your coaching going?",
          message: `You've been training with ${coachName} for 4 weeks. Leave a Pillar rating to help other athletes find the right coach.`,
          data: {
            type: "review_prompt_4_weeks",
            coach_id: coachId,
            client_id: client.id,
            deep_link: `/review/coach/${coachId}`,
            push_title: "How is your coaching going? 🏛️",
            push_body: `4 weeks with ${coachName} — share your experience to help other athletes.`,
          },
          dedupe_key: `review_prompt_4_weeks:${client.id}:${coachId}`,
        });
      }
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
      .select("id, user_id, billing_status, next_due_date")
      .not("user_id", "is", null)
      .or("billing_status.eq.overdue,next_due_date.lte." + today);
    for (const c of billingClients ?? []) {
      if (!c.user_id) continue;
      let overdueAmount = 0;
      try {
        const { data: overduePayments } = await supabase
          .from("client_payments")
          .select("amount")
          .eq("client_id", c.id)
          .in("status", ["overdue", "pending"]);
        overdueAmount = (overduePayments ?? []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
      } catch (_) {}
      const amountText = normalizeCurrencyAmount(overdueAmount || 0);
      toSend.push({
        user_id: c.user_id,
        client_id: c.id,
        trigger_type: "billing_due",
        message: `Payment of ${amountText} is overdue. Tap to update your payment method.`,
        data: { type: "billing_due", client_id: c.id, amount_due: overdueAmount || 0, deep_link: "/profile-account" },
      });
    }

    // --- Coach pending messages: warm drafts for approval (payment 3d+ overdue, missed check-in, low adherence) ---
    const sevenDaysAgoIso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentPayCoachNotifs } = await supabase
      .from("notifications")
      .select("id, data")
      .eq("type", "payment_reminder_auto")
      .gte("created_at", sevenDaysAgoIso);
    const paymentAutoClientIds = new Set<string>();
    for (const r of recentPayCoachNotifs ?? []) {
      const cid = (r?.data as { client_id?: string } | null)?.client_id;
      if (cid) paymentAutoClientIds.add(cid);
    }

    const { data: recentDraftNotifs } = await supabase
      .from("notifications")
      .select("id, data")
      .eq("type", "coach_pending_draft")
      .gte("created_at", sevenDaysAgoIso);
    const draftDedupe = new Set<string>();
    for (const r of recentDraftNotifs ?? []) {
      const d = r?.data as { client_id?: string; trigger_type?: string } | null;
      if (d?.client_id && d?.trigger_type) draftDedupe.add(`${d.client_id}:${d.trigger_type}`);
    }

    const firstNameFromClient = (c: { name?: string | null; full_name?: string | null }) => {
      const raw = (c?.name || c?.full_name || "").trim();
      return raw.split(/\s+/)[0] || "there";
    };

    const coachIdOfClient = (c: { coach_id?: string | null; trainer_id?: string | null }) =>
      String(c.coach_id || c.trainer_id || "").trim();

    const draftBody = (fn: string, trig: string) => {
      if (trig === "missed_checkin") {
        return `Hey ${fn}, haven't seen your check-in this week — hope everything's okay. Send it over when you can, no pressure.`;
      }
      if (trig === "low_adherence") {
        return `Hey ${fn}, nutrition's been a bit harder these last couple of weeks — totally normal. Let me know if we should adjust your targets. Happy to make it easier.`;
      }
      return `Hey ${fn}, just flagging that I haven't seen your payment come through yet — no stress, let me know if anything is up and we'll sort it.`;
    };

    async function hasOpenPending(clientId: string, trigger: string) {
      const { data } = await supabase
        .from("pending_coach_messages")
        .select("id")
        .eq("client_id", clientId)
        .eq("trigger_type", trigger)
        .is("dismissed_at", null)
        .is("approved_at", null)
        .limit(1);
      return !!(data && data.length);
    }

    async function insertCoachPendingDraft(opts: {
      coachId: string;
      clientId: string;
      clientName: string;
      trigger: "payment_overdue" | "missed_checkin" | "low_adherence";
      notifType: "payment_reminder_auto" | "coach_pending_draft";
    }) {
      const { coachId, clientId, clientName, trigger, notifType } = opts;
      if (await hasOpenPending(clientId, trigger)) return;

      const { data: clientRow } = await supabase
        .from("clients")
        .select("id, name, full_name")
        .eq("id", clientId)
        .maybeSingle();
      const fn = firstNameFromClient(clientRow || { name: clientName, full_name: null });
      const draft = draftBody(fn, trigger);

      const { data: inserted, error: insErr } = await supabase
        .from("pending_coach_messages")
        .insert({
          coach_id: coachId,
          client_id: clientId,
          trigger_type: trigger,
          draft_message: draft,
        })
        .select("id")
        .single();
      if (insErr || !inserted?.id) {
        console.error("pending_coach_messages insert", insErr);
        return;
      }

      const title =
        trigger === "payment_overdue"
          ? "Payment reminder ready"
          : trigger === "missed_checkin"
            ? "Check-in nudge ready"
            : "Client adherence nudge ready";
      const message =
        trigger === "payment_overdue"
          ? `Payment reminder ready to send to ${clientName} — tap to review and send`
          : `Draft message ready for ${clientName} — tap to review and send`;

      const { error: nErr } = await supabase.from("notifications").insert({
        profile_id: coachId,
        type: notifType,
        title,
        message,
        data: {
          client_id: clientId,
          pending_message_id: inserted.id,
          trigger_type: trigger,
          deep_link: `/messages/${clientId}`,
        },
        is_read: false,
        category: "action_required",
        entity_id: clientId,
      });
      if (nErr) console.error("coach pending notification", nErr);
      else {
        await sendPushToProfile(supabase, {
          profileId: coachId,
          title,
          body: message,
          data: { type: notifType, deep_link: `/messages/${clientId}` },
        });
      }
    }

    const overduePaymentCutoff = addDays(today, -3);
    const { data: overdueBilling } = await supabase
      .from("client_billing")
      .select("client_id, next_payment_date, billing_status")
      .eq("billing_status", "overdue")
      .lte("next_payment_date", overduePaymentCutoff)
      .not("next_payment_date", "is", null);

    const overdueBillClientIds = [...new Set((overdueBilling ?? []).map((r) => r.client_id).filter(Boolean))];
    if (overdueBillClientIds.length) {
      const { data: billClients } = await supabase
        .from("clients")
        .select("id, name, full_name, coach_id, trainer_id, user_id")
        .in("id", overdueBillClientIds);
      for (const c of billClients ?? []) {
        const coach = coachIdOfClient(c);
        if (!coach || !c.user_id) continue;
        if (paymentAutoClientIds.has(c.id)) continue;
        const displayName = (c.name || c.full_name || "Client").trim() || "Client";
        await insertCoachPendingDraft({
          coachId: coach,
          clientId: c.id,
          clientName: displayName,
          trigger: "payment_overdue",
          notifType: "payment_reminder_auto",
        });
      }
    }

    const lateWeekThreshold = addDays(weekStart, 3);
    if (today >= lateWeekThreshold) {
      for (const c of allClients) {
        if (!c.user_id) continue;
        if (hasCheckin.has(c.id)) continue;
        const coach = coachIdOfClient(c as { coach_id?: string | null; trainer_id?: string | null });
        if (!coach) continue;
        const dedupe = `${c.id}:missed_checkin`;
        if (draftDedupe.has(dedupe)) continue;
        const displayName = (c.name || c.full_name || "Client").trim() || "Client";
        await insertCoachPendingDraft({
          coachId: coach,
          clientId: c.id,
          clientName: displayName,
          trigger: "missed_checkin",
          notifType: "coach_pending_draft",
        });
        draftDedupe.add(dedupe);
      }
    }

    const prevWeekStart = addDays(weekStart, -7);
    const prev2WeekStart = addDays(weekStart, -14);
    const { data: adhRows } = await supabase
      .from("checkins")
      .select("client_id, week_start, nutrition_adherence")
      .in("week_start", [prevWeekStart, prev2WeekStart])
      .not("nutrition_adherence", "is", null);

    const weekAdhByClient = new Map<string, Record<string, number>>();
    for (const row of adhRows ?? []) {
      const cid = String((row as { client_id?: string }).client_id || "");
      const ws = String((row as { week_start?: string }).week_start || "");
      const v = Number((row as { nutrition_adherence?: unknown }).nutrition_adherence);
      if (!cid || !ws || !Number.isFinite(v)) continue;
      const map = weekAdhByClient.get(cid) ?? {};
      map[ws] = Math.max(map[ws] ?? 0, v);
      weekAdhByClient.set(cid, map);
    }

    for (const [clientId, map] of weekAdhByClient) {
      const w1 = map[prevWeekStart];
      const w2 = map[prev2WeekStart];
      if (w1 == null || w2 == null) continue;
      if (w1 >= 60 || w2 >= 60) continue;
      const c = clientById.get(clientId);
      if (!c?.user_id) continue;
      const coach = coachIdOfClient(c as { coach_id?: string | null; trainer_id?: string | null });
      if (!coach) continue;
      const dedupe = `${clientId}:low_adherence`;
      if (draftDedupe.has(dedupe)) continue;
      const displayName = (c.name || c.full_name || "Client").trim() || "Client";
      await insertCoachPendingDraft({
        coachId: coach,
        clientId,
        clientName: displayName,
        trigger: "low_adherence",
        notifType: "coach_pending_draft",
      });
      draftDedupe.add(dedupe);
    }

    // 4) habit_due: clients with at least one active habit and at least one habit not logged for today
    const { data: habits } = await supabase
      .from("client_habits")
      .select("id, client_id")
      .eq("is_active", true);
    const clientHabits = new Map<string, string[]>();
    for (const h of habits ?? []) {
      const list = clientHabits.get(h.client_id) ?? [];
      list.push(h.id);
      clientHabits.set(h.client_id, list);
    }
    const { data: logsToday } = await supabase
      .from("client_habit_logs")
      .select("habit_id")
      .eq("log_date", today);
    const loggedHabitIds = new Set((logsToday ?? []).map((r) => r.habit_id));
    for (const [clientId, habitIds] of clientHabits) {
      const missing = habitIds.some((id) => !loggedHabitIds.has(id));
      if (missing) {
        const c = clientById.get(clientId);
        if (c?.user_id) toSend.push({ user_id: c.user_id, trigger_type: "habit_due" });
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
        let title = isEvening ? TRIGGER_COPY.workout_evening_reminder.title : TRIGGER_COPY.workout_due.title;
        let message = isEvening ? TRIGGER_COPY.workout_evening_reminder.message : TRIGGER_COPY.workout_due.message;
        try {
          const { data: dayMeta } = await supabase
            .from("program_days")
            .select("name")
            .eq("id", programDayId)
            .maybeSingle();
          const { data: exercises } = await supabase
            .from("program_exercises")
            .select("exercise_name, sets, reps, sort_order")
            .eq("day_id", programDayId)
            .order("sort_order", { ascending: true })
            .limit(8);
          const exerciseList = Array.isArray(exercises) ? exercises : [];
          const firstExercise = exerciseList[0];
          const dayName = String(dayMeta?.name || '').trim() || 'Today';
          if (exerciseList.length > 0) {
            const sets = Number(firstExercise?.sets) || 0;
            const reps = Number(firstExercise?.reps) || 0;
            title = `${dayName} ready — ${exerciseList.length} exercise${exerciseList.length === 1 ? '' : 's'}`;
            message = firstExercise?.exercise_name
              ? `Starts with ${firstExercise.exercise_name}${sets > 0 && reps > 0 ? ` ${sets}×${reps}` : ''}. Tap to begin your session.`
              : message;
          }
        } catch (_) {}
        toSend.push({
          client_id: a.client_id,
          user_id: c.user_id,
          trigger_type: isEvening ? "workout_evening_reminder" : "workout_due",
          title,
          message,
          data: {
            type: isEvening ? "workout_evening_reminder" : "workout_due",
            client_id: a.client_id,
            program_day_id: programDayId,
            deep_link: "/today",
          },
        });
      }
    }

    // 6) Supplement reminders: morning / evening / missed (Europe/London wall clock — see getLondonClock)
    const hour = Number(getLondonClock(now).currentTime.slice(0, 2));
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

    // 6) Peak week alerts (type peak_week_update; use custom message + dedupe_key)
    const { data: activePeakWeeks } = await supabase
      .from("peak_weeks")
      .select("id, client_id, show_date")
      .eq("is_active", true);
    for (const pw of activePeakWeeks ?? []) {
      const c = clientById.get(pw.client_id);
      if (!c?.user_id) continue;
      const showDate = pw.show_date as string;

      // 6a) Day -N instructions available: when today is the target_date for that day
      for (let dayNum = -7; dayNum <= 0; dayNum++) {
        const targetDate = addDays(showDate, dayNum);
        if (targetDate !== today) continue;
        toSend.push({
          user_id: c.user_id,
          trigger_type: "peak_week_update",
          title: "Peak week",
          message: `Day ${dayNum} instructions available.`,
          data: { peak_week_id: pw.id, day_number: dayNum },
          dedupe_key: `peak_week_update:day:${dayNum}:${pw.id}`,
        });
      }

      // 6b) Peak week check-in required: today is within peak week and this day has checkin_required and no check-in today
      const dayOffset = Math.round((new Date(today + "T12:00:00Z").getTime() - new Date(showDate + "T12:00:00Z").getTime()) / (24 * 60 * 60 * 1000));
      if (dayOffset >= -7 && dayOffset <= 0) {
        const { data: dayRow } = await supabase
          .from("peak_week_days")
          .select("id, checkin_required")
          .eq("peak_week_id", pw.id)
          .eq("day_number", dayOffset)
          .maybeSingle();
        if (dayRow?.checkin_required) {
          const { data: checkinToday } = await supabase
            .from("peak_week_checkins")
            .select("id")
            .eq("peak_week_id", pw.id)
            .eq("client_id", pw.client_id)
            .gte("created_at", today + "T00:00:00Z")
            .lt("created_at", nextDayISO + "T00:00:00Z")
            .limit(1);
          if (!(checkinToday && checkinToday.length > 0)) {
            toSend.push({
              user_id: c.user_id,
              trigger_type: "peak_week_update",
              title: "Peak week",
              message: "Peak week check-in required.",
              data: { peak_week_id: pw.id },
              dedupe_key: `peak_week_update:checkin:${pw.id}`,
            });
          }
        }
      }
    }

    const userIdToCoachIdForNotifs = new Map<string, string>();
    const coachIdsForBranding = new Set<string>();
    for (const c of allClients) {
      const uid = String((c as { user_id?: string | null }).user_id || "").trim();
      if (!uid) continue;
      const cid = coachIdOfClient(c as { coach_id?: string | null; trainer_id?: string | null });
      if (cid) {
        userIdToCoachIdForNotifs.set(uid, cid);
        coachIdsForBranding.add(cid);
      }
    }
    const coachBrandByCoachId = new Map<string, { brand_name: string | null; plan_tier: string | null }>();
    if (coachIdsForBranding.size > 0) {
      const { data: coachProfiles } = await supabase
        .from("profiles")
        .select("id, plan_tier, brand_name")
        .in("id", [...coachIdsForBranding]);
      for (const p of coachProfiles ?? []) {
        const id = String((p as { id: string }).id);
        coachBrandByCoachId.set(id, {
          brand_name: (p as { brand_name?: string | null }).brand_name ?? null,
          plan_tier: (p as { plan_tier?: string | null }).plan_tier ?? null,
        });
      }
    }

    // Already-sent today: (profile_id, type) or (profile_id, dedupe_key) set (notifications table uses profile_id)
    const { data: existing } = await supabase
      .from("notifications")
      .select("profile_id, type, data")
      .gte("created_at", today + "T00:00:00Z");
    const sentToday = new Set<string>();
    for (const r of existing ?? []) {
      const data = r.data as { dedupe_key?: string } | null;
      const hasDedupeKey = data && typeof data.dedupe_key === "string";
      if (r.type === "peak_week_update" && hasDedupeKey) {
        sentToday.add(`${r.profile_id}:${data!.dedupe_key}`);
      } else {
        sentToday.add(`${r.profile_id}:${r.type}`);
      }
    }

    // Respect per-user notification preferences: an explicit false for the
    // trigger's category skips both the in-app notification and the push.
    const dispatchPrefs = await loadNotificationPrefs(
      supabase,
      toSend.map((t) => String(t.user_id)),
    );

    // London-hour send windows [start, endExclusive). The per-day dedupe resets
    // at UTC midnight, so without these the first */30 cron run of the day
    // pushed "habit reminder" / "workout due" at ~1am. Types not listed are
    // already window-gated where they're created (supplements, evening workout).
    const SEND_WINDOWS: Record<string, [number, number]> = {
      workout_due: [7, 12],
      habit_due: [8, 21],
      checkin_due: [8, 20],
      prep_pose_check_due: [9, 20],
      billing_due: [9, 18],
      coach_review_prompt: [10, 20],
      review_prompt_4_weeks: [10, 20],
      peak_week_update: [6, 22],
    };
    const londonHour = Number(getLondonClock(new Date()).currentTime.slice(0, 2));

    let inserted = 0;
    const byTrigger: Record<string, number> = {};
    for (const item of toSend) {
      const { user_id, trigger_type, title: customTitle, message: customMessage, data: customData, dedupe_key } = item;
      const profileId = user_id;
      if (!isNotificationAllowed(dispatchPrefs, String(profileId), TRIGGER_PREF_KEY[trigger_type])) continue;
      const win = SEND_WINDOWS[trigger_type];
      // Outside the window: skip WITHOUT marking sent — it fires when the window opens.
      if (win && (londonHour < win[0] || londonHour >= win[1])) continue;
      const key = dedupe_key ? `${profileId}:${dedupe_key}` : `${profileId}:${trigger_type}`;
      if (sentToday.has(key)) continue;
      const copy = TRIGGER_COPY[trigger_type] ?? { title: "Reminder", message: "You have an action due." };
      const title = customTitle ?? copy.title;
      const message = customMessage ?? copy.message;
      const data = (customData ?? {}) as Record<string, unknown>;
      if (dedupe_key) data.dedupe_key = dedupe_key;
      const coachIdForUser = userIdToCoachIdForNotifs.get(String(user_id));
      const brandCtx = coachIdForUser ? coachBrandByCoachId.get(coachIdForUser) : undefined;
      if (brandCtx) {
        data.coach_brand_name = brandCtx.brand_name;
        data.coach_plan_tier = brandCtx.plan_tier;
      }
      const { error } = await supabase.from("notifications").insert({
        profile_id: profileId,
        type: trigger_type,
        title,
        message,
        data,
        is_read: false,
      });
      if (!error) {
        inserted += 1;
        sentToday.add(key);
        byTrigger[trigger_type] = (byTrigger[trigger_type] ?? 0) + 1;
        await sendPushToProfile(supabase, {
          profileId,
          title,
          body: message,
          data: {
            type: trigger_type,
            deep_link: typeof (data as Record<string, unknown>).deep_link === "string" ? (data as Record<string, unknown>).deep_link : "",
          },
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        evaluated: toSend.length,
        inserted,
        scheduled_checkin_inserted: scheduledCheckinInserted,
        by_trigger: byTrigger,
      }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("send-reminders", e);
    return new Response(JSON.stringify({ error: "Request failed" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
