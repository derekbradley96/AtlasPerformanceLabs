/**
 * Bridge: builds health context from app data and calls the health engine.
 * Returns engine result plus legacy shape (risk, summary, phase) for HealthBreakdownSheet.
 */
import { evaluateClientHealth, safeDate } from './healthEngine';

function safeArray(x) {
  return Array.isArray(x) ? x : [];
}

/**
 * Get most recent submitted check-in for "latest" metrics.
 */
function getLatestCheckIn(checkIns) {
  const list = safeArray(checkIns);
  const submitted = list
    .filter((c) => (c?.status ?? '').toLowerCase() === 'submitted')
    .sort((a, b) => {
      const ta = safeDate(a?.submitted_at ?? a?.created_date ?? a?.created_at)?.getTime() ?? 0;
      const tb = safeDate(b?.submitted_at ?? b?.created_date ?? b?.created_at)?.getTime() ?? 0;
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });
  return submitted[0] ?? null;
}

/**
 * Recent weights from check-ins (submitted with weight_kg).
 */
function getRecentWeights(checkIns) {
  const list = safeArray(checkIns);
  return list
    .filter((c) => c?.weight_kg != null && (c?.status ?? '').toLowerCase() === 'submitted')
    .map((c) => ({
      occurred_at: c?.submitted_at ?? c?.created_date ?? c?.created_at,
      weight_kg: c?.weight_kg,
    }))
    .sort((a, b) => {
      const ta = safeDate(a?.occurred_at)?.getTime() ?? 0;
      const tb = safeDate(b?.occurred_at)?.getTime() ?? 0;
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    })
    .slice(0, 10);
}

/**
 * Map engine riskLevel to legacy risk for HealthBreakdownSheet.
 */
function toLegacyRisk(riskLevel) {
  if (riskLevel === 'green') return 'low';
  if (riskLevel === 'amber') return 'moderate';
  return 'high';
}

/**
 * Evaluate client health from app data. Safe: never throws.
 * @param {object|null} client - Client record (id, full_name, phase, show_date/showDate, etc.)
 * @param {Array} checkIns - Check-ins for this client
 * @param {object|null} thread - Message thread { unread_count }
 * @returns Engine result + legacy { risk, summary, phase } for existing UI
 */
export function getClientHealth(client, checkIns, thread = null) {
  try {
    const safeCheckIns = safeArray(checkIns);
    const latestCheckIn = getLatestCheckIn(safeCheckIns);
    const recentWeights = getRecentWeights(safeCheckIns);
    const messageSummary =
      thread != null && typeof thread === 'object'
        ? { unreadCount: thread?.unread_count ?? 0 }
        : null;

    const context = {
      latestCheckIn,
      messageSummary,
      recentWeights,
      checkIns: safeCheckIns,
    };

    const result = evaluateClientHealth(client ?? null, context);

    return {
      ...result,
      risk: toLegacyRisk(result.riskLevel),
      summary:
        result.reasons.length > 0
          ? result.reasons.join('; ')
          : `Score ${result.score}. ${result.bandLabel}.`,
      phase: result.meta?.phase ?? null,
    };
  } catch (e) {
    console.error('[healthEngineBridge] getClientHealth:', e);
    return {
      score: 0,
      riskLevel: 'red',
      bandLabel: 'At risk',
      reasons: ['Unable to compute health'],
      actions: [],
      flags: [],
      meta: {
        phase: null,
        daysOut: null,
        sensitivity: 1,
        breakdown: { compliance: 0, trend: 0, recovery: 0, comms: 0 },
      },
      risk: 'high',
      summary: 'Unable to compute health.',
      phase: null,
    };
  }
}

export { evaluateClientHealth, derivePhase, safeNumber, safeDate } from './healthEngine';
