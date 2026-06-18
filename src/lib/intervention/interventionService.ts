/**
 * Intervention snapshot: health, retention, queue, check-ins.
 * Live Supabase when configured; selector sandbox fallback for demo/offline.
 */
import * as sandbox from '@/lib/sandboxStore';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getClientHealthScoreSnapshot } from '@/lib/healthScoreService';
import { computeHealthScore } from '@/lib/healthScore';
import { getCoachType } from '@/lib/data/coachProfileRepo';
import type { Client } from '@/lib/types/client';
import type { Payment } from '@/lib/types/payment';
import type { MessageThread } from '@/lib/types/messageThread';
import { getRetentionItem } from '@/lib/retention/retentionRepo';
import { getClientPhase } from '@/lib/clientPhaseStore';
import { getClientCompProfile } from '@/lib/repos/compPrepRepo';
import { buildTrainerQueue } from '@/lib/reviewQueue/buildQueue';
import { evaluateFatigue } from '@/lib/energy/fatigueRules';
import { getRollingAverage } from '@/lib/energy/energyRepo';

export interface InterventionSnapshot {
  client: {
    id: string;
    name: string;
    phase: string;
    goal: string | null;
    compProfile: { showDate?: string; division?: string; federation?: string } | null;
  };
  health: {
    score: number;
    risk: number;
    status: string;
    reasons: string[];
    breakdown: Record<string, number>;
  };
  retention: {
    level: string;
    score: number;
    reasons: Array<{ detail: string }>;
  } | null;
  workload: {
    pendingReviews: number;
    overduePayment: boolean;
    unreadThreads: number;
    peakWeekDueToday: boolean;
  };
  trends: {
    weight: { last14dDelta: number | null; direction: 'up' | 'down' | 'stable'; points: Array<{ date: string; kg: number }> };
    strength: { keyLiftDeltas: Array<{ name: string; delta: number }>; summary: string };
    adherence: { last2Avg: number | null; last4Avg: number | null };
    checkins: { lastSubmittedAt: string | null; missedCount28d: number };
    /** Plain-language summary (Atlas Law 7). */
    interpretation?: string | null;
  };
  context: {
    showDate?: string;
    daysToShow?: number;
    division?: string;
    federation?: string;
  };
  recovery?: {
    energyAvg7d: number;
    sleepAvg7d: number | null;
    fatigueLevel: string;
    signals: string[];
  };
}

type CheckinRow = {
  weight_kg?: number | null;
  adherence_pct?: number | null;
  sleep_hours?: number | null;
  steps?: number | null;
  notes?: string | null;
  submitted_at?: string | null;
  created_at?: string | null;
  created_date?: string | null;
  week_start?: string | null;
  reviewed_at?: string | null;
  status?: string | null;
  energy_level?: number | null;
};

function normalizeCheckinRow(c: CheckinRow) {
  const submitted_at = c.submitted_at ?? c.created_at ?? null;
  const created_date = c.created_date ?? c.created_at ?? submitted_at ?? null;
  const status = String(c.status || 'submitted').toLowerCase();
  return { ...c, submitted_at, created_date, status };
}

async function getDemoInterventionSnapshot(clientId: string, now: Date): Promise<InterventionSnapshot | null> {
  const client = sandbox.getClientById(clientId);
  if (!client) return null;
  const phase = getClientPhase(clientId, client);
  const compProfile = getClientCompProfile(clientId);
  const healthSnap = getClientHealthScoreSnapshot(clientId);
  const retentionItem = getRetentionItem(clientId);
  const checkins = sandbox.listCheckIns(clientId) ?? [];
  const submitted = checkins
    .map((c) => normalizeCheckinRow(c as CheckinRow))
    .filter((c) => c.status === 'submitted')
    .sort(
      (a, b) =>
        new Date(b.submitted_at || b.created_date || 0).getTime() - new Date(a.submitted_at || a.created_date || 0).getTime()
    );
  const payments = sandbox.listPayments(clientId) ?? [];
  const overduePayment =
    (client as { payment_overdue?: boolean }).payment_overdue ??
    payments.some((p) => (p.status || '').toLowerCase() === 'overdue');
  const queue = await buildTrainerQueue({ trainerId: (client as { trainer_id?: string }).trainer_id ?? '', now });
  const unreadThreads = 0;
  const fatigue = evaluateFatigue(clientId, { now, client, checkIns: submitted });
  const { energyAvg: energyAvg7d, sleepAvg: sleepAvg7d } = getRollingAverage(clientId, 7);
  return buildBody({
    client: client as Record<string, unknown>,
    clientId,
    phase: phase ?? 'Maintenance',
    compProfile,
    submitted,
    overduePayment,
    unreadThreads,
    queue,
    now,
    healthSnap,
    retentionItem,
    fatigue,
    energyAvg7d,
    sleepAvg7d,
  });
}

function weekStartMonday(iso: string): string {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset);
  return d.toISOString().slice(0, 10);
}

function buildTrendInterpretation(args: {
  missed28: number;
  last2Avg: number | null;
  last4Avg: number | null;
  lastSubmittedAt: string | null;
}): string | null {
  const parts: string[] = [];
  if (args.missed28 > 0) {
    parts.push(
      `${args.missed28} weekly check-in${args.missed28 === 1 ? '' : 's'} missed in the last 28 days`
    );
  }
  if (args.last4Avg != null && args.last2Avg != null && args.last2Avg < args.last4Avg - 4) {
    parts.push(
      `adherence down from about ${Math.round(args.last4Avg)}% (last 4 check-ins) to about ${Math.round(args.last2Avg)}% (last 2) this month`
    );
  }
  if (args.lastSubmittedAt) {
    const d = new Date(args.lastSubmittedAt);
    if (!Number.isNaN(d.getTime())) {
      const days = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
      if (days >= 10) {
        parts.push(`last check-in was ${days} days ago`);
      }
    }
  }
  return parts.length ? parts.join(' — ') : null;
}

function toClientForHealth(row: Record<string, unknown>, overduePayment: boolean): Client {
  const coachId = row.coach_id != null ? String(row.coach_id) : '';
  const trainerId = row.trainer_id != null ? String(row.trainer_id) : '';
  return {
    id: String(row.id || ''),
    user_id: row.user_id != null ? String(row.user_id) : null,
    trainer_id: trainerId || coachId,
    full_name: String(row.full_name || row.name || 'Client'),
    status: 'on_track',
    payment_overdue: overduePayment,
  };
}

async function fetchThreadMeta(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  clientId: string
): Promise<{ unread: number; lastAt: string | null }> {
  const { data: threadRow, error } = await supabase
    .from('message_threads')
    .select('id, coach_last_read_at, updated_at')
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error || !threadRow) return { unread: 0, lastAt: null };
  const updatedAtMs = threadRow.updated_at ? new Date(threadRow.updated_at as string).getTime() : 0;
  const coachReadMs = threadRow.coach_last_read_at
    ? new Date(threadRow.coach_last_read_at as string).getTime()
    : 0;
  const unread = !threadRow.coach_last_read_at ? (updatedAtMs > 0 ? 1 : 0) : updatedAtMs > coachReadMs ? 1 : 0;
  return { unread, lastAt: threadRow.updated_at != null ? String(threadRow.updated_at) : null };
}

function buildBody(args: {
  client: Record<string, unknown>;
  clientId: string;
  phase: string;
  compProfile: ReturnType<typeof getClientCompProfile>;
  submitted: ReturnType<typeof normalizeCheckinRow>[];
  overduePayment: boolean;
  unreadThreads: number;
  queue: Awaited<ReturnType<typeof buildTrainerQueue>>;
  now: Date;
  healthSnap: ReturnType<typeof getClientHealthScoreSnapshot>;
  retentionItem: ReturnType<typeof getRetentionItem>;
  fatigue: ReturnType<typeof evaluateFatigue>;
  energyAvg7d: number;
  sleepAvg7d: number | null;
}): InterventionSnapshot {
  const {
    client,
    clientId,
    phase,
    compProfile,
    submitted,
    overduePayment,
    unreadThreads,
    queue,
    now,
    healthSnap,
    retentionItem,
    fatigue,
    energyAvg7d,
    sleepAvg7d,
  } = args;

  const activeForClient = queue.filter((i) => i.status === 'ACTIVE' && i.clientId === clientId);
  const pendingReviews = activeForClient.filter(
    (i) => i.type === 'CHECKIN_REVIEW' || i.type === 'POSING_REVIEW' || i.type === 'MISSING_MANDATORY_POSES'
  ).length;
  const peakWeekDueToday = activeForClient.some((i) => i.type === 'PEAK_WEEK_DUE');

  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const weightPoints = submitted
    .filter(
      (c) =>
        c.weight_kg != null &&
        (c.submitted_at || c.created_date) &&
        new Date(c.submitted_at || c.created_date).getTime() >= fourteenDaysAgo.getTime()
    )
    .map((c) => ({ date: (c.submitted_at || c.created_date)!.slice(0, 10), kg: c.weight_kg! }))
    .sort((a, b) => a.date.localeCompare(b.date));
  let last14dDelta: number | null = null;
  let weightDirection: 'up' | 'down' | 'stable' = 'stable';
  if (weightPoints.length >= 2) {
    const first = weightPoints[0].kg;
    const last = weightPoints[weightPoints.length - 1].kg;
    last14dDelta = Math.round((last - first) * 10) / 10;
    if (last14dDelta > 0.2) weightDirection = 'up';
    else if (last14dDelta < -0.2) weightDirection = 'down';
  }

  const last2Avg =
    submitted.length >= 2
      ? ((submitted[0].adherence_pct ?? 0) + (submitted[1].adherence_pct ?? 0)) / 2
      : submitted.length === 1
        ? submitted[0].adherence_pct ?? null
        : null;
  const last4Avg =
    submitted.length >= 4
      ? (submitted[0].adherence_pct! +
          submitted[1].adherence_pct! +
          submitted[2].adherence_pct! +
          submitted[3].adherence_pct!) /
        4
      : null;

  const submittedWeekStarts = new Set<string>();
  submitted.forEach((c) => {
    const t = c.submitted_at || c.created_date;
    if (t) submittedWeekStarts.add(weekStartMonday(t));
  });
  const expectedWeekStarts: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - 7 * i);
    expectedWeekStarts.push(weekStartMonday(d.toISOString()));
  }
  const missedCount28d = expectedWeekStarts.filter((w) => !submittedWeekStarts.has(w)).length;
  const lastSubmittedAt = submitted[0] ? submitted[0].submitted_at || submitted[0].created_date : null;

  let daysToShow: number | undefined;
  if (compProfile?.showDate) {
    const show = new Date(compProfile.showDate);
    show.setHours(0, 0, 0, 0);
    const n = new Date(now);
    n.setHours(0, 0, 0, 0);
    daysToShow = Math.ceil((show.getTime() - n.getTime()) / (24 * 60 * 60 * 1000));
  }

  const interpretation = buildTrendInterpretation({
    missed28: Math.max(0, missedCount28d),
    last2Avg,
    last4Avg,
    lastSubmittedAt: lastSubmittedAt ? String(lastSubmittedAt) : null,
  });

  return {
    client: {
      id: String((client as { id?: string }).id),
      name: String((client as { full_name?: string; name?: string }).full_name ?? (client as { name?: string }).name ?? 'Client'),
      phase: phase ?? 'Maintenance',
      goal: (client as { goal?: string | null }).goal ?? null,
      compProfile: compProfile
        ? { showDate: compProfile.showDate, division: compProfile.division, federation: compProfile.federation }
        : null,
    },
    health: {
      score: healthSnap?.score ?? 0,
      risk: healthSnap?.risk ?? 100,
      status: healthSnap?.status ?? 'at_risk',
      reasons: healthSnap?.reasons ?? [],
      breakdown: healthSnap?.breakdown ?? {
        adherence: 0,
        checkinConsistency: 0,
        goalAlignment: 0,
        strengthTrend: 0,
        engagement: 0,
        payments: 0,
      },
    },
    retention: retentionItem
      ? {
          level: retentionItem.level,
          score: retentionItem.score,
          reasons: retentionItem.reasons.map((r) => ({ detail: r.detail })),
        }
      : null,
    workload: {
      pendingReviews,
      overduePayment: !!overduePayment,
      unreadThreads,
      peakWeekDueToday,
    },
    trends: {
      weight: { last14dDelta, direction: weightDirection, points: weightPoints },
      strength: { keyLiftDeltas: [], summary: 'No lift data' },
      adherence: { last2Avg, last4Avg },
      checkins: {
        lastSubmittedAt: lastSubmittedAt ? String(lastSubmittedAt) : null,
        missedCount28d: Math.max(0, missedCount28d),
      },
      interpretation,
    },
    context: {
      showDate: compProfile?.showDate,
      daysToShow,
      division: compProfile?.division,
      federation: compProfile?.federation,
    },
    recovery: {
      energyAvg7d: Math.round(energyAvg7d * 10) / 10,
      sleepAvg7d: sleepAvg7d != null ? Math.round(sleepAvg7d * 10) / 10 : null,
      fatigueLevel: fatigue.fatigueLevel,
      signals: fatigue.signals,
    },
  };
}

export async function getInterventionSnapshot(clientId: string, now: Date = new Date()): Promise<InterventionSnapshot | null> {
  if (!hasSupabase) {
    return getDemoInterventionSnapshot(clientId, now);
  }
  const supabase = getSupabase();
  if (!supabase) return getDemoInterventionSnapshot(clientId, now);

  const { data: row, error } = await supabase
    .from('clients')
    .select('id, name, full_name, coach_id, trainer_id, client_type, user_id')
    .eq('id', clientId)
    .maybeSingle();

  if (error || !row) return null;

  const { data: checkinRows, error: chErr } = await supabase
    .from('checkins')
    .select(
      'id, client_id, weight_kg, adherence_pct, sleep_hours, steps, notes, submitted_at, week_start, reviewed_at, created_at, created_date, status, energy_level'
    )
    .eq('client_id', clientId)
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .limit(8);

  if (chErr) console.warn('[interventionService] checkins', chErr.message);

  const checkins = (Array.isArray(checkinRows) ? checkinRows : []).map((c) => normalizeCheckinRow(c as CheckinRow));

  const { data: billing } = await supabase
    .from('client_billing')
    .select('billing_status, next_payment_date')
    .eq('client_id', clientId)
    .maybeSingle();

  const billingStatus = String(billing?.billing_status || '').toLowerCase();
  const overduePayment = billingStatus === 'overdue' || billingStatus === 'pending_payment';

  const { unread: unreadThreads, lastAt: threadLastAt } = await fetchThreadMeta(supabase, clientId);

  const phase = getClientPhase(clientId, row as never);
  const compProfile = getClientCompProfile(clientId);
  const submitted = checkins
    .filter((c) => c.status === 'submitted')
    .sort(
      (a, b) =>
        new Date(b.submitted_at || b.created_date || 0).getTime() -
        new Date(a.submitted_at || a.created_date || 0).getTime()
    );

  const trainerKey = String(row.trainer_id || row.coach_id || '');
  const queue = await buildTrainerQueue({ trainerId: trainerKey, now });

  const clientForHealth = toClientForHealth(row as Record<string, unknown>, overduePayment);
  let payStatus: Payment['status'] = 'paid';
  if (overduePayment) payStatus = 'overdue';
  else if (billingStatus === 'pending' || billingStatus === 'pending_payment') payStatus = 'pending';

  const paymentsForScore: Payment[] = [
    {
      status: payStatus,
      due_date: billing?.next_payment_date != null ? String(billing.next_payment_date) : null,
    },
  ];
  const threadsForScore: MessageThread[] = [
    {
      id: 'thread',
      client_id: clientId,
      unread_count: unreadThreads,
      last_message_at: threadLastAt,
    },
  ];
  const recentForScore = submitted.slice(0, 12).map((c) => ({
    submitted_at: c.submitted_at,
    created_date: c.created_date,
    weight_kg: c.weight_kg,
    adherence_pct: c.adherence_pct,
    metrics:
      c.energy_level != null || c.sleep_hours != null
        ? {
            ...(c.energy_level != null ? { energy: c.energy_level } : {}),
            ...(c.sleep_hours != null ? { sleep: c.sleep_hours } : {}),
          }
        : null,
  }));

  const fatigue = evaluateFatigue(clientId, { now, client: clientForHealth, checkIns: submitted });
  const coachType = trainerKey ? getCoachType(trainerKey) : null;
  const healthComputed = computeHealthScore(
    clientForHealth,
    recentForScore,
    paymentsForScore,
    threadsForScore,
    phase ?? null,
    null,
    {
      fatigueLevel: fatigue.fatigueLevel,
      fatigueScore: fatigue.fatigueScore,
      strengthExplainedByFatigue: fatigue.strengthExplainedByFatigue,
    },
    coachType
  );

  const retentionItem = getRetentionItem(clientId);
  const { energyAvg: energyAvg7d, sleepAvg: sleepAvg7d } = getRollingAverage(clientId, 7);

  const activeForClient = queue.filter((i) => i.status === 'ACTIVE' && i.clientId === clientId);
  const pendingReviews = activeForClient.filter(
    (i) => i.type === 'CHECKIN_REVIEW' || i.type === 'POSING_REVIEW' || i.type === 'MISSING_MANDATORY_POSES'
  ).length;
  const peakWeekDueToday = activeForClient.some((i) => i.type === 'PEAK_WEEK_DUE');

  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const weightPoints = submitted
    .filter(
      (c) =>
        c.weight_kg != null &&
        (c.submitted_at || c.created_date) &&
        new Date(c.submitted_at || c.created_date || '').getTime() >= fourteenDaysAgo.getTime()
    )
    .map((c) => ({
      date: (c.submitted_at || c.created_date)!.slice(0, 10),
      kg: c.weight_kg!,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  let last14dDelta: number | null = null;
  let weightDirection: 'up' | 'down' | 'stable' = 'stable';
  if (weightPoints.length >= 2) {
    const first = weightPoints[0].kg;
    const last = weightPoints[weightPoints.length - 1].kg;
    last14dDelta = Math.round((last - first) * 10) / 10;
    if (last14dDelta > 0.2) weightDirection = 'up';
    else if (last14dDelta < -0.2) weightDirection = 'down';
  }

  const last2Avg =
    submitted.length >= 2
      ? ((submitted[0].adherence_pct ?? 0) + (submitted[1].adherence_pct ?? 0)) / 2
      : submitted.length === 1
        ? submitted[0].adherence_pct ?? null
        : null;
  const last4Avg =
    submitted.length >= 4
      ? (submitted[0].adherence_pct! +
          submitted[1].adherence_pct! +
          submitted[2].adherence_pct! +
          submitted[3].adherence_pct!) /
        4
      : null;

  const submittedWeekStarts = new Set<string>();
  submitted.forEach((c) => {
    const t = c.submitted_at || c.created_date;
    if (t) submittedWeekStarts.add(weekStartMonday(t));
  });
  const expectedWeekStarts: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - 7 * i);
    expectedWeekStarts.push(weekStartMonday(d.toISOString()));
  }
  const missedCount28d = expectedWeekStarts.filter((w) => !submittedWeekStarts.has(w)).length;
  const lastSubmittedAt = submitted[0] ? submitted[0].submitted_at || submitted[0].created_date : null;

  let daysToShow: number | undefined;
  if (compProfile?.showDate) {
    const show = new Date(compProfile.showDate);
    show.setHours(0, 0, 0, 0);
    const n = new Date(now);
    n.setHours(0, 0, 0, 0);
    daysToShow = Math.ceil((show.getTime() - n.getTime()) / (24 * 60 * 60 * 1000));
  }

  const interpretation = buildTrendInterpretation({
    missed28: Math.max(0, missedCount28d),
    last2Avg,
    last4Avg,
    lastSubmittedAt: lastSubmittedAt ? String(lastSubmittedAt) : null,
  });

  return {
    client: {
      id: String(row.id),
      name: String(row.full_name || row.name || 'Client'),
      phase: phase ?? 'Maintenance',
      goal: (row as { goal?: string | null }).goal ?? null,
      compProfile: compProfile
        ? { showDate: compProfile.showDate, division: compProfile.division, federation: compProfile.federation }
        : null,
    },
    health: {
      score: healthComputed.score,
      risk: healthComputed.risk,
      status: healthComputed.status,
      reasons: healthComputed.reasons,
      breakdown: healthComputed.breakdown ?? {
        adherence: 0,
        checkinConsistency: 0,
        goalAlignment: 0,
        strengthTrend: 0,
        engagement: 0,
        payments: 0,
      },
    },
    retention: retentionItem
      ? {
          level: retentionItem.level,
          score: retentionItem.score,
          reasons: retentionItem.reasons.map((r) => ({ detail: r.detail })),
        }
      : null,
    workload: {
      pendingReviews,
      overduePayment: !!overduePayment,
      unreadThreads,
      peakWeekDueToday,
    },
    trends: {
      weight: { last14dDelta, direction: weightDirection, points: weightPoints },
      strength: { keyLiftDeltas: [], summary: 'No lift data' },
      adherence: { last2Avg, last4Avg },
      checkins: { lastSubmittedAt: lastSubmittedAt ? String(lastSubmittedAt) : null, missedCount28d: Math.max(0, missedCount28d) },
      interpretation,
    },
    context: {
      showDate: compProfile?.showDate,
      daysToShow,
      division: compProfile?.division,
      federation: compProfile?.federation,
    },
    recovery: {
      energyAvg7d: Math.round(energyAvg7d * 10) / 10,
      sleepAvg7d: sleepAvg7d != null ? Math.round(sleepAvg7d * 10) / 10 : null,
      fatigueLevel: fatigue.fatigueLevel,
      signals: fatigue.signals,
    },
  };
}
