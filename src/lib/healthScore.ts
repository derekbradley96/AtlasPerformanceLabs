/**
 * Client Health Score API: single source of truth in intelligence/healthScore.
 * Re-exports compute + maps to output with risk = 100 - score, statusLabel.
 */
import { computeHealthScore as core, type HealthScoreResult, type FatigueInput } from '@/lib/intelligence/healthScore';
import { getHealthScoreConfigForCoachType } from '@/lib/intelligence/healthScoreConfig';
import type { Client } from '@/lib/types/client';
import type { Payment } from '@/lib/types/payment';
import type { MessageThread } from '@/lib/types/messageThread';
import type { CheckinLike } from '@/lib/intelligence/healthScore';

export type HealthStatus = 'on_track' | 'monitor' | 'at_risk';

export interface HealthScoreOutput {
  score: number;
  risk: number;
  status: HealthStatus;
  statusLabel: string;
  reasons: string[];
  breakdown: HealthScoreResult['breakdown'] | null;
}

/**
 * Compute health score from client, checkins, payments, message threads.
 * risk = 100 - score. Reasons derived only from failed thresholds, max 4.
 * Optional fatigue from evaluateFatigue applies modifiers (HIGH -10, LOW +5, soften strength).
 */
export function computeHealthScore(
  client: Client | null,
  recentCheckins: CheckinLike[],
  payments: Payment[],
  messageThreads: MessageThread[],
  phase?: string | null,
  goal?: string | null,
  fatigue?: FatigueInput | null,
  coachType?: 'general' | 'prep' | 'both' | null
): HealthScoreOutput {
  if (!client) {
    return {
      score: 0,
      risk: 100,
      status: 'at_risk',
      statusLabel: 'Unknown',
      reasons: ['No client data'],
      breakdown: null,
    };
  }

  const config = coachType ? getHealthScoreConfigForCoachType(coachType) : undefined;
  const result = core({
    client: {
      baselineWeight: client.baselineWeight ?? undefined,
      baselineStrength: client.baselineStrength ?? undefined,
    },
    phase: phase ?? client.phase ?? 'maintenance',
    goal: goal ?? null,
    checkins: recentCheckins,
    lifts: null,
    messageThreads: (messageThreads ?? []).map((t) => ({
      unread_count: t?.unread_count ?? 0,
      last_message_at: t?.last_message_at ?? null,
    })),
    payments: (payments ?? []).map((p) => ({ status: p?.status ?? '' })),
    now: Date.now(),
    config,
    fatigue: fatigue ?? undefined,
  });

  const statusLabel =
    result.status === 'on_track' ? 'On track' : result.status === 'monitor' ? 'Monitor' : 'At risk';

  return {
    score: result.score,
    risk: result.risk,
    status: result.status,
    statusLabel,
    reasons: result.reasons,
    breakdown: result.breakdown,
  };
}
