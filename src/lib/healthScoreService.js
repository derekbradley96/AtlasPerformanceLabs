/**
 * Client Health Score: single source of truth in intelligence/healthScore.
 * risk = 100 - score. Persists snapshot via intelligence/healthScoreRepo.
 * Optional `options.client` / `options.checkins` / etc. from React Query for live roster data.
 */
import { getClientById as getSyncClientFromService } from '@/data/clientsService';
import * as sandbox from '@/lib/sandboxStore';
import {
  listClientCheckInsForInbox,
  listPaymentsForInbox,
  getMessageThreadsRowForClient,
  getTrainerClientsList,
} from '@/lib/inboxLocalSources';
import { getCoachType } from '@/lib/data/coachProfileRepo';
import { getClientPhase } from '@/lib/clientPhaseStore';
import { computeHealthScore } from '@/lib/healthScore';
import { getHealthScoreSnapshot, setHealthScoreSnapshot } from '@/lib/intelligence/healthScoreRepo';
import { evaluateFatigue } from '@/lib/energy/fatigueRules';

function resolveClient(clientId, options) {
  if (options?.client && String(options.client.id) === String(clientId)) return options.client;
  return getSyncClientFromService(clientId) || sandbox.getClientById(clientId);
}

/**
 * Get health score for a client. Computes from check-ins, payments, messages; persists snapshot.
 * Returns score, risk (100 - score), status, statusLabel, reasons (max 4), breakdown.
 */
export function getClientHealthScore(clientId, options = {}) {
  const client = resolveClient(clientId, options);
  if (!client) {
    return { score: 0, risk: 100, status: 'at_risk', statusLabel: 'Unknown', reasons: [], breakdown: null, phase: 'maintenance' };
  }

  const phase = getClientPhase(clientId, client);
  const checkins = Array.isArray(options.checkins)
    ? options.checkins
    : listClientCheckInsForInbox(clientId) ?? [];
  const submitted = (checkins ?? []).filter((c) => c?.status === 'submitted');
  const recentCheckins = [...submitted].sort(
    (a, b) => new Date(b.submitted_at || b.created_date) - new Date(a.submitted_at || a.created_date)
  );
  const payments = Array.isArray(options.payments) ? options.payments : listPaymentsForInbox(clientId);
  const messageThreads = Array.isArray(options.messageThreads)
    ? options.messageThreads
    : getMessageThreadsRowForClient(clientId);

  const fatigue = evaluateFatigue(clientId, { now: new Date(), client, checkIns: submitted });
  const fatigueInput = {
    fatigueLevel: fatigue.fatigueLevel,
    fatigueScore: fatigue.fatigueScore,
    strengthExplainedByFatigue: fatigue.strengthExplainedByFatigue,
  };

  const tid = (client.trainer_id ?? client.coach_id) ? String(client.trainer_id ?? client.coach_id) : '';
  const coachType = options.coachType ?? (tid ? getCoachType(tid) : undefined);
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
  const list = Array.isArray(options.clients) ? options.clients : getTrainerClientsList(trainerId);
  const clients = Array.isArray(list) ? list : [];
  return (clients ?? [])
    .map((c) => (c?.id ? {
      clientId: c.id,
      client: c,
      ...getClientHealthScore(c.id, { ...options, client: c }),
    } : null))
    .filter(Boolean)
    .filter((r) => r?.status !== 'on_track')
    .sort((a, b) => (a?.score ?? 0) - (b?.score ?? 0));
}
