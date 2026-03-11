/**
 * Capacity snapshot from same sources as Global Review (buildTrainerQueue + retention).
 */
import { buildTrainerQueue } from '@/lib/reviewQueue/buildQueue';
import { listActiveRetentionItems } from '@/lib/retention/retentionRepo';
import { getClients } from '@/data/selectors';
import { getClientHealthScoreSnapshot } from '@/lib/healthScoreService';
import { getDailyAdminLimitMinutesForTrainer } from '@/lib/trainerFoundation';
import {
  MIN_PER_CHECKIN,
  MIN_PER_POSING,
  MIN_PEAK_WEEK,
  MIN_PAYMENT,
  MIN_MESSAGE_THREAD,
  MIN_LEAD,
  BUSY_BUFFER_MINUTES,
} from './capacityConfig';

export type CapacityStatus = 'IN_CONTROL' | 'BUSY' | 'OVERLOADED';

export interface CapacitySnapshot {
  counts: {
    activeClients: number;
    atRiskClients: number;
    retentionHigh: number;
    reviewsActive: number;
    checkinsActive: number;
    posingActive: number;
    peakWeekDueToday: number;
    overduePayments: number;
    unreadThreads: number;
    newLeads: number;
  };
  minutes: {
    checkins: number;
    posing: number;
    peakWeek: number;
    payments: number;
    messages: number;
    leads: number;
    total: number;
  };
  status: CapacityStatus;
  guidance: string;
  updatedAt: string;
  dailyLimitMinutes: number;
}

export async function getCapacitySnapshot(trainerId: string, now: Date = new Date()): Promise<CapacitySnapshot> {
  const queue = await buildTrainerQueue({ trainerId, now });
  const active = queue.filter((i) => i.status === 'ACTIVE');
  const clients = getClients().filter((c) => c.trainer_id === trainerId);
  const retentionItems = listActiveRetentionItems(trainerId, now);

  let atRiskClients = 0;
  clients.forEach((c) => {
    const snap = getClientHealthScoreSnapshot(c.id);
    const score = typeof snap?.score === 'number' ? snap.score : 100;
    if (score < 60) atRiskClients += 1;
  });

  const retentionHigh = retentionItems.filter((r) => r.score >= 80).length;
  const checkinsActive = active.filter((i) => i.type === 'CHECKIN_REVIEW').length;
  const posingActive = active.filter((i) => i.type === 'POSING_REVIEW' || i.type === 'MISSING_MANDATORY_POSES').length;
  const peakWeekDueToday = active.filter((i) => i.type === 'PEAK_WEEK_DUE').length;
  const overduePayments = active.filter((i) => i.type === 'PAYMENT_OVERDUE').length;
  const unreadThreads = active.filter((i) => i.type === 'UNREAD_MESSAGES').length;
  const newLeads = active.filter((i) => i.type === 'NEW_LEAD').length;
  const reviewsActive = checkinsActive + posingActive;

  const limit = getDailyAdminLimitMinutesForTrainer(trainerId);
  const minCheckins = checkinsActive * MIN_PER_CHECKIN;
  const minPosing = posingActive * MIN_PER_POSING;
  const minPeakWeek = peakWeekDueToday * MIN_PEAK_WEEK;
  const minPayments = overduePayments * MIN_PAYMENT;
  const minMessages = unreadThreads * MIN_MESSAGE_THREAD;
  const minLeads = newLeads * MIN_LEAD;
  const total = minCheckins + minPosing + minPeakWeek + minPayments + minMessages + minLeads;

  let status: CapacityStatus = 'IN_CONTROL';
  if (total > limit + BUSY_BUFFER_MINUTES) status = 'OVERLOADED';
  else if (total > limit) status = 'BUSY';

  let guidance: string;
  if (status === 'OVERLOADED') {
    guidance = 'Clear Global Review first, then messages. Defer non-urgent leads.';
  } else if (status === 'BUSY') {
    guidance = 'Start with payments + reviews, then comp prep.';
  } else {
    guidance = "You're clear. Focus on proactive check-ins.";
  }

  return {
    counts: {
      activeClients: clients.length,
      atRiskClients,
      retentionHigh,
      reviewsActive,
      checkinsActive,
      posingActive,
      peakWeekDueToday,
      overduePayments,
      unreadThreads,
      newLeads,
    },
    minutes: {
      checkins: minCheckins,
      posing: minPosing,
      peakWeek: minPeakWeek,
      payments: minPayments,
      messages: minMessages,
      leads: minLeads,
      total,
    },
    status,
    guidance,
    updatedAt: now.toISOString(),
    dailyLimitMinutes: limit,
  };
}
