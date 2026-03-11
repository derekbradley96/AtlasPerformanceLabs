/**
 * Weekly snapshot for Call Prep: wins, slips, flags, lastCheckinLabel, checkinDueLabel.
 * Uses existing health/risk/check-in data; safe placeholders when missing.
 */

import { getChatContextSnapshot } from '@/lib/chatContextSnapshot';

/**
 * @param {string} clientId
 * @param {{ getClientById?: (id: string) => unknown, getClientCheckIns?: (id: string) => unknown[], getClientRiskEvaluation?: (id: string) => { riskReasons?: string[] } }} deps
 * @returns {{ wins: string[], slips: string[], flags: string[], lastCheckinLabel: string, checkinDueLabel: string }}
 */
export function getWeeklySnapshot(clientId, deps = {}) {
  const snapshot = getChatContextSnapshot(clientId, deps);
  return {
    wins: Array.isArray(snapshot.wins) ? snapshot.wins : ['No wins logged yet'],
    slips: Array.isArray(snapshot.slips) ? snapshot.slips : ['No slips this week'],
    flags: Array.isArray(snapshot.flags) ? snapshot.flags : [],
    lastCheckinLabel: snapshot.lastCheckIn ?? 'No check-in yet',
    checkinDueLabel: snapshot.checkInDue ?? '—',
  };
}

/**
 * Build summary payload for a summary card message (title, wins, slips, nextSteps).
 * @param {{ wins: string[], slips: string[], lastCheckIn?: string, checkInDue?: string, lastCheckinLabel?: string, checkinDueLabel?: string }} snapshot
 * @param {string} [clientName]
 */
export function buildSummaryCardPayload(snapshot, clientName = '') {
  const checkinDue = snapshot?.checkinDueLabel ?? snapshot?.checkInDue ?? '—';
  const lastCheckin = snapshot?.lastCheckinLabel ?? snapshot?.lastCheckIn ?? 'No check-in yet';
  const nextSteps = [];
  if (checkinDue && checkinDue !== '—') {
    nextSteps.push(`Next check-in due: ${checkinDue}`);
  }
  if (lastCheckin && lastCheckin !== 'No check-in yet') {
    nextSteps.push(`Last check-in: ${lastCheckin}`);
  }
  if (nextSteps.length === 0) nextSteps.push('Keep up the great work!');
  return {
    title: 'Weekly Summary',
    wins: snapshot?.wins ?? [],
    slips: snapshot?.slips ?? [],
    nextSteps,
    clientName: clientName || undefined,
  };
}
