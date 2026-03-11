/**
 * Client performance snapshot: weeks with trainer, adherence %, weight delta, PR count.
 */
import { getClientById, getClientCheckIns } from '@/data/selectors';
import { getClientRiskScore } from '@/lib/riskService';

/** Weeks since client.created_date. */
export function getWeeksWithTrainer(clientId) {
  const client = getClientById(clientId);
  if (!client?.created_date) return 0;
  const start = new Date(client.created_date);
  const now = new Date();
  return Math.max(0, Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000)));
}

/** Adherence %: submitted check-ins vs expected (e.g. 1 per week since start). */
export function getAdherencePct(clientId) {
  const client = getClientById(clientId);
  if (!client?.created_date) return null;
  const weeks = getWeeksWithTrainer(clientId);
  if (weeks === 0) return 100;
  const checkIns = getClientCheckIns(clientId);
  const submitted = checkIns.filter((c) => c.status === 'submitted').length;
  const expected = weeks;
  if (expected === 0) return 100;
  return Math.min(100, Math.round((submitted / expected) * 100));
}

/** Weight delta since first submitted check-in with weight. */
export function getWeightDeltaSinceStart(clientId) {
  const checkIns = getClientCheckIns(clientId).filter((c) => c.weight_kg != null && (c.submitted_at || c.created_date));
  if (checkIns.length < 2) return null;
  const sorted = [...checkIns].sort((a, b) => new Date(a.submitted_at || a.created_date) - new Date(b.submitted_at || b.created_date));
  const first = sorted[0].weight_kg;
  const last = sorted[sorted.length - 1].weight_kg;
  return { first, last, delta: last - first };
}

/** Mock PR count (e.g. from workout logs – not implemented). */
export function getPrCount(clientId) {
  return 0;
}

/**
 * Full snapshot for Client Detail header card.
 */
export function getClientPerformanceSnapshot(clientId) {
  const weeks = getWeeksWithTrainer(clientId);
  const adherencePct = getAdherencePct(clientId);
  const weightDelta = getWeightDeltaSinceStart(clientId);
  const prCount = getPrCount(clientId);
  const risk = getClientRiskScore(clientId);

  return {
    weeksWithTrainer: weeks,
    adherencePct,
    weightDelta: weightDelta?.delta ?? null,
    weightFirst: weightDelta?.first ?? null,
    weightLast: weightDelta?.last ?? null,
    prCount,
    riskScore: risk.score,
    riskBand: risk.band,
  };
}
