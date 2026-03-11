/**
 * Atlas Edge: Retention Radar — retention risk flags from existing data (no ML).
 * Flags: low adherence (<60% last 2 check-ins), no check-in 14 days, unread > 3 days, payment overdue.
 */
import { getClients, getClientCheckIns, getThreadsForTrainer } from '@/data/selectors';
import { getClientMarkedPaid } from '@/lib/clientDetailStorage';

const ADHERENCE_THRESHOLD = 60;
const NO_CHECKIN_DAYS = 14;
const UNREAD_STALE_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysAgo(iso) {
  if (!iso) return 999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / MS_PER_DAY);
}

/**
 * @param {string} trainerId
 * @returns {{ count: number, clients: { clientId: string, reasons: string[] }[] }}
 */
export function getRetentionRadar(trainerId) {
  const clients = getClients().filter((c) => c.trainer_id === trainerId);
  const threads = getThreadsForTrainer(trainerId);
  const result = [];

  clients.forEach((client) => {
    const reasons = [];
    const checkIns = getClientCheckIns(client.id).filter((c) => c.status === 'submitted');
    const sorted = [...checkIns].sort((a, b) => new Date(b.submitted_at || b.created_date) - new Date(a.submitted_at || a.created_date));
    const last2 = sorted.slice(0, 2);
    const lastCheckinAt = sorted[0] ? (sorted[0].submitted_at || sorted[0].created_date) : null;

    if (last2.length >= 2) {
      const avgAdherence = last2.reduce((s, c) => s + (c.adherence_pct ?? 0), 0) / last2.length;
      if (avgAdherence < ADHERENCE_THRESHOLD) reasons.push('Low adherence');
    }
    if (lastCheckinAt && daysAgo(lastCheckinAt) > NO_CHECKIN_DAYS) reasons.push('No check-in 14+ days');
    else if (!lastCheckinAt && checkIns.length === 0) reasons.push('No check-in 14+ days');

    const thread = threads.find((t) => t.client_id === client.id);
    if (thread && (thread.unread_count || 0) > 0 && thread.last_message_at) {
      if (daysAgo(thread.last_message_at) > UNREAD_STALE_DAYS) reasons.push('Unread messages > 3 days');
    }

    if (client.payment_overdue && !getClientMarkedPaid(client.id)) reasons.push('Payment overdue');

    if (reasons.length > 0) {
      result.push({ clientId: client.id, clientName: client.full_name, reasons });
    }
  });

  return {
    count: result.length,
    clients: result,
  };
}
