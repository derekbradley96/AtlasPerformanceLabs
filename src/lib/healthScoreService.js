/**
 * Client Health Score: single source of truth in intelligence/healthScore.
 * risk = 100 - score. Persists snapshot via intelligence/healthScoreRepo.
 */
import { getClients, getClientById, getClientCheckIns, getPaymentsForClient, getMessageThreadsForClient } from '@/data/selectors';
import { getCoachType } from '@/lib/data/coachProfileRepo';
import { getClientPhase } from '@/lib/clientPhaseStore';
import { computeHealthScore } from '@/lib/healthScore';
import { getHealthScoreSnapshot, setHealthScoreSnapshot } from '@/lib/intelligence/healthScoreRepo';
import { evaluateFatigue } from '@/lib/energy/fatigueRules';

/**
 * Get health score for a client. Computes from check-ins, payments, messages; persists snapshot.
 * Returns score, risk (100 - score), status, statusLabel, reasons (max 4), breakdown.
 */
export function getClientHealthScore(clientId, options = {}) {
  const client = getClientById(clientId);
  if (!client) {
    return { score: 0, risk: 100, status: 'at_risk', statusLabel: 'Unknown', reasons: [], breakdown: null, phase: 'maintenance' };
  }

  const phase = getClientPhase(clientId, client);
  const checkins = getClientCheckIns(clientId) ?? [];
  const submitted = (checkins ?? []).filter((c) => c?.status === 'submitted');
  const recentCheckins = [...submitted].sort(
    (a, b) => new Date(b.submitted_at || b.created_date) - new Date(a.submitted_at || a.created_date)
  );
  const payments = getPaymentsForClient(clientId);
  const messageThreads = getMessageThreadsForClient(clientId);

  const fatigue = evaluateFatigue(clientId, { now: new Date() });
  const fatigueInput = {
    fatigueLevel: fatigue.fatigueLevel,
    fatigueScore: fatigue.fatigueScore,
    strengthExplainedByFatigue: fatigue.strengthExplainedByFatigue,
  };

  const coachType = options.coachType ?? (client.trainer_id ? getCoachType(client.trainer_id) : undefined);
  const result = computeHealthScore(
    client,
    recentCheckins,
    payments ?? [],
    messageThreads ?? [],
    phase,
    options.goal ?? null,
    fatigueInput,
    coachType
  );

  setHealthScoreSnapshot(clientId, {
    date: new Date().toISOString().slice(0, 10),
    phase,
    score: result.score,
    risk: result.risk,
    status: result.status,
    reasons: result.reasons,
    breakdown: result.breakdown ?? {
      adherence: 0,
      checkinConsistency: 0,
      goalAlignment: 0,
      strengthTrend: 0,
      engagement: 0,
      payments: 0,
    },
  });

  return {
    score: result.score,
    risk: result.risk,
    status: result.status,
    statusLabel: result.statusLabel,
    reasons: result.reasons,
    breakdown: result.breakdown,
    phase,
  };
}

/**
 * Get latest persisted snapshot only (no recompute). Useful for list view.
 */
export function getClientHealthScoreSnapshot(clientId) {
  return getHealthScoreSnapshot(clientId);
}

/** Get all clients for trainer with health score (compute and return score + status). */
export function getClientsNeedingAttention(trainerId, options = {}) {
  const clients = (getClients() ?? []).filter((c) => c?.trainer_id === trainerId);
  return (clients ?? [])
    .map((c) => (c?.id ? {
      clientId: c.id,
      client: c,
      ...getClientHealthScore(c.id, options),
    } : null))
    .filter(Boolean)
    .filter((r) => r?.status !== 'on_track')
    .sort((a, b) => (a?.score ?? 0) - (b?.score ?? 0));
}
