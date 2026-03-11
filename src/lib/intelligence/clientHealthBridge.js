/**
 * Bridge to clientHealth.ts for use in JS (ClientDetail, Clients list, Inbox).
 */
import { computeClientHealth } from './clientHealth';

export function getClientHealthSnapshot(client, checkins) {
  if (!client) return { status: 'stable', score0to100: 100, reasons: [] };
  return computeClientHealth(client, checkins || []);
}

export { computeClientHealth };
