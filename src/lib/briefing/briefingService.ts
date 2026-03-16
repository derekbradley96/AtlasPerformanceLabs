/**
 * Coach Briefing: daily and weekly. Facts only, same sources as Global Review.
 */
import { buildTrainerQueue } from '@/lib/reviewQueue/buildQueue';
import { getClients, getClientById } from '@/data/selectors';
import { getClientHealthScoreSnapshot } from '@/lib/healthScoreService';
import { getPreviousHealthForRetention } from '@/lib/retention/retentionRepo';
import { getStoredRetention } from '@/lib/retention/retentionRepo';
import { listActiveRetentionItems } from '@/lib/retention/retentionRepo';
import { getClientMarkedPaid } from '@/lib/clientDetailStorage';
import { getWeeklyCloseoutHistory } from '@/lib/closeoutStore';
import { notifyCoachPaymentOverdue } from '@/services/notificationTriggers';
import { filterCriticalQueueItems } from '@/lib/silentMode/silentModeRules';
import { evaluateFatigue } from '@/lib/energy/fatigueRules';

const CLOSEOUT_LOG_KEY = 'atlas_closeout_log';

function getCloseoutLogEntries(): Array<{ date: string; counts?: { reviews: number; posing: number; payments: number }; totalCleared?: number }> {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(CLOSEOUT_LOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw) ?? [];
  } catch {
    return [];
  }
}

const LOG_KEY = 'atlas_closeout_log';
const HEALTH_DROP_THRESHOLD = 15;
const NEW_FLAG_HOURS = 24;

export type PriorityType = 'PEAK_WEEK_DUE' | 'PAYMENT_OVERDUE' | 'CHECKIN_REVIEW' | 'POSING_REVIEW' | 'RETENTION_RISK' | 'UNREAD_MESSAGES' | 'NEW_LEAD' | 'MISSING_MANDATORY_POSES';

export interface TopPriorityItem {
  clientId: string;
  clientName: string;
  type: PriorityType;
  why: string;
  route: string;
  priorityScore: number;
}

export interface DailyBriefing {
  date: string;
  counts: {
    activeItems: number;
    reviews: { checkins: number; posing: number };
    peakWeekDueToday: number;
    overduePayments: number;
    retentionHigh: number;
    unreadThreads: number;
    newLeads: number;
    highFatigueCount: number;
  };
  topPriorities: TopPriorityItem[];
  changes: {
    healthDrops: Array<{ clientId: string; clientName: string; delta: number; route: string }>;
    newRetentionFlags: Array<{ clientId: string; clientName: string; reason: string; route: string }>;
    newlyOverdue: Array<{ clientId: string; clientName: string; amount?: number; route: string }>;
  };
  suggestedOrder: string[];
  lastUpdatedAt: string;
}

export interface WeeklyBriefing {
  weekStart: string;
  weekEnd: string;
  totals: {
    reviewsCompleted: number;
    posingReviewed: number;
    paymentsCollected: number;
    paymentsOverdue: number;
    retentionFlagsTriggered: number;
    newClients: number;
    churnedClients: number;
    closeoutsCompleted: number;
    avgHealthScore: number | null;
  };
  highlights: string[];
  risks: string[];
}

export interface GetDailyBriefingOptions {
  onlyCritical?: boolean;
}

export async function getDailyBriefing(
  trainerId: string,
  now: Date = new Date(),
  options: GetDailyBriefingOptions = {}
): Promise<DailyBriefing> {
  const date = now.toISOString().slice(0, 10);
  const queue = await buildTrainerQueue({ trainerId, now });
  let active = queue.filter((i) => i.status === 'ACTIVE');
  if (options.onlyCritical) {
    active = filterCriticalQueueItems(active, { now });
  }

  const checkins = active.filter((i) => i.type === 'CHECKIN_REVIEW').length;
  const posing = active.filter((i) => i.type === 'POSING_REVIEW' || i.type === 'MISSING_MANDATORY_POSES').length;
  const peakWeekDueToday = active.filter((i) => i.type === 'PEAK_WEEK_DUE').length;
  const overduePayments = active.filter((i) => i.type === 'PAYMENT_OVERDUE').length;
  const retentionHigh = active.filter((i) => i.type === 'RETENTION_RISK').length;
  const unreadThreads = active.filter((i) => i.type === 'UNREAD_MESSAGES').length;
  const newLeads = active.filter((i) => i.type === 'NEW_LEAD').length;

  const topPriorities: TopPriorityItem[] = active.slice(0, 5).map((i) => ({
    clientId: i.clientId ?? '',
    clientName: i.clientName ?? 'Client',
    type: i.type as PriorityType,
    why: i.why ?? '',
    route: i.route ?? '',
    priorityScore: i.priorityScore ?? 0,
  }));

  const clients = getClients().filter((c) => c.trainer_id === trainerId);
  let highFatigueCount = 0;
  for (const c of clients) {
    const fatigue = evaluateFatigue(c.id, { now });
    if (fatigue.fatigueLevel === 'HIGH') highFatigueCount += 1;
  }
  const twentyFourHoursAgo = new Date(now.getTime() - NEW_FLAG_HOURS * 60 * 60 * 1000);

  const healthDrops: DailyBriefing['changes']['healthDrops'] = [];
  for (const c of clients) {
    const current = getClientHealthScoreSnapshot(c.id)?.score;
    const prev = getPreviousHealthForRetention(c.id)?.score;
    if (current != null && prev != null && current < prev - HEALTH_DROP_THRESHOLD) {
      healthDrops.push({
        clientId: c.id,
        clientName: c.full_name ?? 'Client',
        delta: Math.round((prev - current) * 10) / 10,
        route: `/clients/${c.id}/intervention`,
      });
    }
  }

  const newRetentionFlags: DailyBriefing['changes']['newRetentionFlags'] = [];
  try {
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k?.startsWith('atlas_retention_') || k.startsWith('atlas_retention_health_')) continue;
        const clientId = k.slice('atlas_retention_'.length);
        const stored = getStoredRetention(clientId);
        if (!stored || stored.item.trainerId !== trainerId) continue;
        const seenAt = new Date(stored.lastSeenAt);
        if (seenAt >= twentyFourHoursAgo) {
          const client = getClientById(clientId);
          const reason = stored.item.reasons[0]?.detail ?? 'Retention risk';
          newRetentionFlags.push({
            clientId,
            clientName: client?.full_name ?? 'Client',
            reason,
            route: `/clients/${clientId}/intervention`,
          });
        }
      }
    }
  } catch {}

  const newlyOverdue: DailyBriefing['changes']['newlyOverdue'] = [];
  for (const c of clients) {
    if (c.payment_overdue && !getClientMarkedPaid(c.id)) {
      newlyOverdue.push({
        clientId: c.id,
        clientName: c.full_name ?? 'Client',
        route: `/clients/${c.id}`,
      });
      notifyCoachPaymentOverdue(trainerId, c.id).catch(() => {});
    }
  }

  const suggestedOrder: string[] = [];
  if (peakWeekDueToday > 0) suggestedOrder.push('Peak week');
  if (overduePayments > 0) suggestedOrder.push('Payments');
  if (checkins > 0 || posing > 0) suggestedOrder.push('Reviews');
  if (unreadThreads > 0) suggestedOrder.push('Messages');
  if (newLeads > 0) suggestedOrder.push('Leads');

  return {
    date,
    counts: {
      activeItems: active.length,
      reviews: { checkins, posing },
      peakWeekDueToday,
      overduePayments,
      retentionHigh,
      unreadThreads,
      newLeads,
      highFatigueCount,
    },
    topPriorities,
    changes: { healthDrops, newRetentionFlags, newlyOverdue },
    suggestedOrder: suggestedOrder.length ? suggestedOrder : ['Reviews', 'Messages', 'Leads'],
    lastUpdatedAt: now.toISOString(),
  };
}

function getWeekRange(weekStartDate: string): { start: string; end: string } {
  const start = new Date(weekStartDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function getWeeklyBriefing(trainerId: string, weekStartDate: string): WeeklyBriefing {
  const { start: weekStart, end: weekEnd } = getWeekRange(weekStartDate);
  const history = getWeeklyCloseoutHistory();
  const closeoutsCompleted = history.filter((h) => h.done).length;
  let reviewsCompleted = 0;
  let posingReviewed = 0;
  let paymentsCollected = 0;
  try {
    const list = getCloseoutLogEntries();
    const inRange = list.filter((e) => e.date >= weekStart && e.date <= weekEnd);
    inRange.forEach((e) => {
      reviewsCompleted += e.counts?.reviews ?? 0;
      posingReviewed += e.counts?.posing ?? 0;
      paymentsCollected += e.counts?.payments ?? 0;
    });
  } catch {}

  const clients = getClients().filter((c) => c.trainer_id === trainerId);
  let paymentsOverdue = 0;
  let avgHealthScore: number | null = null;
  let healthSum = 0;
  let healthCount = 0;
  for (const c of clients) {
    if (c.payment_overdue) paymentsOverdue += 1;
    const snap = getClientHealthScoreSnapshot(c.id);
    if (typeof snap?.score === 'number') {
      healthSum += snap.score;
      healthCount += 1;
    }
  }
  if (healthCount > 0) avgHealthScore = Math.round((healthSum / healthCount) * 10) / 10;

  const highlights: string[] = [];
  if (reviewsCompleted > 0) highlights.push(`${reviewsCompleted} review(s) completed this week`);
  if (closeoutsCompleted > 0) highlights.push(`${closeoutsCompleted} closeout(s) completed`);
  if (avgHealthScore != null) highlights.push(`Avg client health: ${avgHealthScore}`);

  const risks: string[] = [];
  if (paymentsOverdue > 0) risks.push(`${paymentsOverdue} client(s) with overdue payment`);
  const retentionCount = listActiveRetentionItems(trainerId).length;
  if (retentionCount > 0) risks.push(`${retentionCount} retention risk(s) active`);

  return {
    weekStart,
    weekEnd,
    totals: {
      reviewsCompleted,
      posingReviewed,
      paymentsCollected,
      paymentsOverdue,
      retentionFlagsTriggered: 0,
      newClients: 0,
      churnedClients: 0,
      closeoutsCompleted,
      avgHealthScore,
    },
    highlights,
    risks,
  };
}
