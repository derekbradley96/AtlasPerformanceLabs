/**
 * Intervention snapshot: single source from health, retention, queue, checkins.
 */
import { getClientById, getClientCheckIns, getThreadByClientId, getPaymentsForClient } from '@/data/selectors';
import { getClientHealthScoreSnapshot } from '@/lib/healthScoreService';
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
  };
  context: {
    showDate?: string;
    daysToShow?: number;
    division?: string;
    federation?: string;
  };
  /** Recovery & Energy: 7d energy/sleep, fatigue level, signals. */
  recovery?: {
    energyAvg7d: number;
    sleepAvg7d: number | null;
    fatigueLevel: string;
    signals: string[];
  };
}

function weekStartMonday(iso: string): string {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset);
  return d.toISOString().slice(0, 10);
}

export async function getInterventionSnapshot(clientId: string, now: Date = new Date()): Promise<InterventionSnapshot | null> {
  const client = getClientById(clientId);
  if (!client) return null;

  const phase = getClientPhase(clientId, client);
  const compProfile = getClientCompProfile(clientId);
  const healthSnap = getClientHealthScoreSnapshot(clientId);
  const retentionItem = getRetentionItem(clientId);
  const checkins = getClientCheckIns(clientId);
  const submitted = checkins
    .filter((c) => c.status === 'submitted')
    .sort((a, b) => new Date(b.submitted_at || b.created_date).getTime() - new Date(a.submitted_at || a.created_date).getTime());
  const thread = getThreadByClientId(clientId);
  const payments = getPaymentsForClient(clientId);
  const overduePayment = client.payment_overdue ?? payments.some((p) => (p.status || '').toLowerCase() === 'overdue');

  const queue = await buildTrainerQueue({ trainerId: client.trainer_id ?? '', now });
  const activeForClient = queue.filter((i) => i.status === 'ACTIVE' && i.clientId === clientId);
  const pendingReviews = activeForClient.filter(
    (i) => i.type === 'CHECKIN_REVIEW' || i.type === 'POSING_REVIEW' || i.type === 'MISSING_MANDATORY_POSES'
  ).length;
  const peakWeekDueToday = activeForClient.some((i) => i.type === 'PEAK_WEEK_DUE');
  const unreadThreads = thread?.unread_count ?? 0;

  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const weightPoints = submitted
    .filter((c) => c.weight_kg != null && (c.submitted_at || c.created_date) && new Date(c.submitted_at || c.created_date) >= fourteenDaysAgo)
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
      ? (submitted[0].adherence_pct! + submitted[1].adherence_pct! + submitted[2].adherence_pct! + submitted[3].adherence_pct!) / 4
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
  const lastSubmittedAt = submitted[0] ? (submitted[0].submitted_at || submitted[0].created_date) : null;

  let daysToShow: number | undefined;
  if (compProfile?.showDate) {
    const show = new Date(compProfile.showDate);
    show.setHours(0, 0, 0, 0);
    const n = new Date(now);
    n.setHours(0, 0, 0, 0);
    daysToShow = Math.ceil((show.getTime() - n.getTime()) / (24 * 60 * 60 * 1000));
  }

  const fatigue = evaluateFatigue(clientId, { now });
  const { energyAvg: energyAvg7d, sleepAvg: sleepAvg7d } = getRollingAverage(clientId, 7);

  return {
    client: {
      id: client.id,
      name: client.full_name ?? 'Client',
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
      checkins: { lastSubmittedAt, missedCount28d: Math.max(0, missedCount28d) },
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
