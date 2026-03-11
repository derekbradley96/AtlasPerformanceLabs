/**
 * Builds a coach-only "This Week" snapshot for the Chat Context panel.
 * Uses check-ins, risk evaluation, and health when available; safe placeholders when not.
 */

import { safeDate } from '@/lib/format';

function safeArray(x) {
  return Array.isArray(x) ? x : [];
}

function safeStr(x) {
  return typeof x === 'string' ? x : '';
}

/**
 * @param {string} clientId
 * @param {{ getClientById?: (id: string) => unknown, getClientCheckIns?: (id: string) => unknown[], getClientRiskEvaluation?: (id: string) => { riskReasons?: string[], riskScore?: number }, getClientHealth?: (id: string) => unknown }} deps
 * @returns {{ wins: string[], slips: string[], flags: string[], checkInDue: string | null, lastCheckIn: string | null }}
 */
export function getChatContextSnapshot(clientId, deps = {}) {
  const getClientById = deps.getClientById ?? (() => null);
  const getClientCheckIns = deps.getClientCheckIns ?? (() => []);
  const getClientRiskEvaluation = deps.getClientRiskEvaluation ?? (() => ({}));
  const getClientHealth = deps.getClientHealth ?? (() => null);

  const wins = [];
  const slips = [];
  const flags = [];

  try {
    const client = clientId ? getClientById(clientId) : null;
    const checkInsRaw = clientId ? getClientCheckIns(clientId) : [];
    const checkIns = safeArray(checkInsRaw);
    const risk = clientId ? getClientRiskEvaluation(clientId) : {};
    const riskReasons = safeArray(risk?.riskReasons);
    const health = clientId && typeof getClientHealth === 'function' ? getClientHealth(clientId) : null;

    // Last check-in
    const submitted = checkIns
      .filter((c) => (c?.status ?? '').toLowerCase() === 'submitted')
      .sort((a, b) => {
        const ta = safeDate(a?.submitted_at ?? a?.created_date)?.getTime() ?? 0;
        const tb = safeDate(b?.submitted_at ?? b?.created_date)?.getTime() ?? 0;
        return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
      });
    const lastCheckIn = submitted[0];
    const lastCheckInStr = lastCheckIn
      ? safeDate(lastCheckIn?.submitted_at ?? lastCheckIn?.created_date)?.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) ?? null
      : null;

    // Check-in due (next pending)
    const pending = checkIns.filter((c) => (c?.status ?? '').toLowerCase() === 'pending');
    const nextPending = pending.sort((a, b) => {
      const ta = safeDate(a?.due_date ?? a?.created_date)?.getTime() ?? 0;
      const tb = safeDate(b?.due_date ?? b?.created_date)?.getTime() ?? 0;
      return (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0);
    })[0];
    const checkInDueStr = nextPending
      ? safeDate(nextPending?.due_date ?? nextPending?.created_date)?.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) ?? null
      : null;

    // Wins: good adherence, positive notes from last check-in
    const lastAdherence = lastCheckIn?.adherence_pct;
    if (typeof lastAdherence === 'number' && lastAdherence >= 80) {
      wins.push(`Adherence ${lastAdherence}% on last check-in`);
    }
    if (client?.phase) {
      wins.push(`Phase: ${safeStr(client.phase)}`);
    }
    if (health?.score != null && health.score >= 70) {
      wins.push(`Health score ${health.score}`);
    }
    if (wins.length === 0) wins.push('No wins logged yet');

    // Slips: low adherence, missed check-ins
    if (typeof lastAdherence === 'number' && lastAdherence < 80 && lastAdherence > 0) {
      slips.push(`Adherence ${lastAdherence}% on last check-in`);
    }
    if (pending.length > 0) {
      slips.push(`${pending.length} check-in(s) pending`);
    }
    if (riskReasons.length > 0) {
      riskReasons.slice(0, 3).forEach((r) => {
        if (typeof r === 'string' && r.length) flags.push(r);
      });
    }
    if (slips.length === 0) slips.push('No slips this week');
    if (flags.length === 0 && (risk?.riskScore ?? 0) >= 50) flags.push('Elevated risk score');

    return {
      wins: wins.slice(0, 3),
      slips: slips.slice(0, 3),
      flags: flags.slice(0, 3),
      checkInDue: checkInDueStr,
      lastCheckIn: lastCheckInStr,
    };
  } catch (e) {
    console.error('[getChatContextSnapshot]', e);
    return {
      wins: ['No data yet'],
      slips: ['—'],
      flags: ['—'],
      checkInDue: null,
      lastCheckIn: null,
    };
  }
}

/**
 * Client-friendly summary text (for "Send to client" or preview).
 * @param {{ wins: string[], slips: string[], flags: string[], checkInDue: string | null, lastCheckIn: string | null }} snapshot
 * @param {string} [clientName]
 */
export function formatClientSummary(snapshot, clientName = '') {
  const lines = [];
  if (clientName) lines.push(`Hi ${clientName},\n`);
  lines.push('Here’s a quick snapshot from your coach:\n');
  if (snapshot.wins?.length && snapshot.wins[0] !== 'No wins logged yet') {
    lines.push('Wins: ' + snapshot.wins.slice(0, 3).join(' · ') + '\n');
  }
  if (snapshot.lastCheckIn) {
    lines.push(`Last check-in: ${snapshot.lastCheckIn}`);
  }
  if (snapshot.checkInDue) {
    lines.push(`Next check-in due: ${snapshot.checkInDue}`);
  }
  if (lines.length <= 2) lines.push('Keep up the great work!');
  return lines.join('\n').trim();
}
