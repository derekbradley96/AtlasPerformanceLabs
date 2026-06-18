/**
 * Risk scoring per client. Score 0–100.
 * Phase-aware evaluation via evaluateClientRisk; fallback to legacy factors.
 * Optional `access` passes client/check-ins from React Query so production is not tied to sandbox-only stores.
 */
import { getClientById as getSyncClientFromService } from '@/data/clientsService';
import * as sandbox from '@/lib/sandboxStore';
import { listClientCheckInsForInbox, getInboxMessagesByClientId, getTrainerClientsList } from '@/lib/inboxLocalSources';
import { getClientMarkedPaid } from '@/lib/clientDetailStorage';
import { evaluateClientRisk } from '@/lib/intelligence/clientRisk';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function resolveClient(clientId, access = {}) {
  if (access.client && String(access.client.id) === String(clientId)) return access.client;
  return getSyncClientFromService(clientId) || sandbox.getClientById(clientId);
}

function resolveCheckIns(clientId, access = {}) {
  if (Array.isArray(access.checkIns) && access.client && String(access.client.id) === String(clientId)) {
    return access.checkIns;
  }
  return listClientCheckInsForInbox(clientId);
}

/** Weight trend from check-ins: negative = regression. */
function getWeightTrend(clientId, access = {}) {
  const checkIns = resolveCheckIns(clientId, access).filter((c) => c.weight_kg != null && (c.submitted_at || c.created_date));
  if (checkIns.length < 2) return 0;
  const sorted = [...checkIns].sort((a, b) => new Date(a.submitted_at || a.created_date) - new Date(b.submitted_at || b.created_date));
  const first = sorted[0].weight_kg;
  const last = sorted[sorted.length - 1].weight_kg;
  return last - first;
}

/** Last message date (any sender) in thread. */
function getLastMessageDate(clientId, access = {}) {
  const msgs = access.getMessagesByClientId ? access.getMessagesByClientId(clientId) : getInboxMessagesByClientId(clientId);
  if (!msgs.length) return null;
  const last = msgs[msgs.length - 1];
  return last?.created_date ? new Date(last.created_date) : null;
}

/**
 * Phase-aware risk evaluation: riskScore, riskReasons, recommendedAction.
 * @param {string} clientId
 * @param {{ client?: object, checkIns?: object[], getMessagesByClientId?: (id: string) => object[] }} [access]
 */
export function getClientRiskEvaluation(clientId, access = {}) {
  const client = resolveClient(clientId, access);
  const checkIns = resolveCheckIns(clientId, access);
  if (!client) return { riskScore: 0, riskReasons: [], recommendedAction: 'No action needed.', phase: 'maintenance', flags: {} };
  return evaluateClientRisk(client, checkIns);
}

/**
 * Compute risk score 0–100 and contributing factors.
 * Uses phase-aware evaluateClientRisk, then adds payment/engagement.
 * Green 0–30, Amber 31–60, Red 61+
 * @param {string} clientId
 * @param {{ client?: object, checkIns?: object[], getMessagesByClientId?: (id: string) => object[] }} [access]
 */
export function getClientRiskScore(clientId, access = {}) {
  const client = resolveClient(clientId, access);
  if (!client) return { score: 0, band: 'green', factors: [], riskReasons: [], recommendedAction: 'No action needed.' };

  const phaseEval = getClientRiskEvaluation(clientId, access);
  const factors = (phaseEval?.riskReasons ?? []).map((r, i) => ({ key: `reason_${i}`, label: r, value: 1, points: 0 }));
  let score = phaseEval?.riskScore ?? 0;

  const checkIns = resolveCheckIns(clientId, access);
  const pendingCheckIns = checkIns.filter((c) => c.status === 'pending');
  const missedCount = pendingCheckIns.length;
  if (missedCount > 0) {
    const points = Math.min(30, missedCount * 12);
    score += points;
    factors.push({ key: 'missed_checkins', label: 'Missed check-ins', value: missedCount, points });
  }

  const lastMsg = getLastMessageDate(clientId, access);
  const daysSinceMessage = lastMsg ? (Date.now() - lastMsg.getTime()) / (24 * 60 * 60 * 1000) : 999;
  if (daysSinceMessage >= 7) {
    const points = Math.min(25, 10 + Math.floor(daysSinceMessage / 7) * 5);
    score += points;
    factors.push({ key: 'engagement_drop', label: 'No message in 7+ days', value: Math.floor(daysSinceMessage), points });
  }

  const paymentOverdue = client.payment_overdue && !getClientMarkedPaid(clientId);
  if (paymentOverdue) {
    score += 25;
    factors.push({ key: 'payment_late', label: 'Payment overdue', value: 1, points: 25 });
  }

  const clamped = Math.min(100, Math.round(score));
  const band = clamped <= 30 ? 'green' : clamped <= 60 ? 'amber' : 'red';

  return {
    score: clamped,
    band,
    factors,
    riskReasons: phaseEval?.riskReasons ?? [],
    recommendedAction: phaseEval?.recommendedAction ?? 'No action needed.',
  };
}

/**
 * Get all trainer clients with risk score >= 31 (amber + red), sorted by score desc.
 * @param {string} trainerId
 * @param {{ clients?: object[] }} [access] — when provided, uses this roster instead of local sandbox merge.
 */
export function getAtRiskClients(trainerId, access = {}) {
  const list = Array.isArray(access.clients) ? access.clients : getTrainerClientsList(trainerId);
  const clients = Array.isArray(list) ? list : [];
  return (clients || [])
    .map((c) => (c?.id ? { clientId: c.id, client: c, ...getClientRiskScore(c.id, { client: c }) } : null))
    .filter(Boolean)
    .filter((r) => r.score >= 31)
    .sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0));
}
