/**
 * Atlas Edge: Retention Radar — retention risk flags from existing data (no ML).
 * Flags: low adherence (<60% last 2 check-ins), no check-in 14 days, unread > 3 days, payment overdue.
 */
import { getClients, getCheckInsForTrainer } from '@/data/repos/atlasRepo';
import { getSupabase } from '@/lib/supabaseClient';
import { getThreadsForUser } from '@/lib/messaging/supabaseMessaging';
import { getClientMarkedPaid } from '@/lib/clientDetailStorage';

const ADHERENCE_THRESHOLD = 60;
const NO_CHECKIN_DAYS = 14;
const UNREAD_STALE_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysAgo(iso) {
  if (!iso) return 999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / MS_PER_DAY);
}

function isDemoTrainerId(trainerId) {
  const id = trainerId == null ? '' : String(trainerId);
  return id === 'demo-trainer' || id === 'local-trainer' || id === 'local-coach' || id === 'fake-trainer';
}

/**
 * @param {string} trainerId
 * @returns {Promise<{ count: number, clients: { clientId: string, clientName: string, reasons: string[] }[] }>}
 */
export async function getRetentionRadar(trainerId) {
  const isDemoMode = isDemoTrainerId(trainerId);
  const clients = await getClients(trainerId, isDemoMode);
  const allCheckins = await getCheckInsForTrainer(trainerId, isDemoMode);

  const supabase = getSupabase();
  let threads = [];
  if (supabase && trainerId && !isDemoMode) {
    try {
      threads = await getThreadsForUser(supabase, trainerId, 'coach');
    } catch {
      threads = [];
    }
  }

  const result = [];

  (clients || []).forEach((client) => {
    if (!client?.id) return;
    const reasons = [];
    const checkIns = allCheckins
      .filter((c) => c && String(c.client_id) === String(client.id) && String(c.status || '').toLowerCase() === 'submitted');
    const sorted = [...checkIns].sort(
      (a, b) => new Date(b.submitted_at || b.created_date || 0) - new Date(a.submitted_at || a.created_date || 0),
    );
    const last2 = sorted.slice(0, 2);
    const lastCheckinAt = sorted[0] ? sorted[0].submitted_at || sorted[0].created_date : null;

    if (last2.length >= 2) {
      const avgAdherence = last2.reduce((s, c) => s + (c.adherence_pct ?? 0), 0) / last2.length;
      if (avgAdherence < ADHERENCE_THRESHOLD) reasons.push('Low adherence');
    }
    if (lastCheckinAt && daysAgo(lastCheckinAt) > NO_CHECKIN_DAYS) reasons.push('No check-in 14+ days');
    else if (!lastCheckinAt && checkIns.length === 0) reasons.push('No check-in 14+ days');

    const thread = threads.find((t) => t && String(t.client_id) === String(client.id));
    if (thread && (thread.unread_count || 0) > 0 && thread.last_message_at) {
      if (daysAgo(thread.last_message_at) > UNREAD_STALE_DAYS) reasons.push('Unread messages > 3 days');
    }

    const name = client.full_name ?? client.name ?? 'Client';
    if (client.payment_overdue && !getClientMarkedPaid(client.id)) reasons.push('Payment overdue');

    if (reasons.length > 0) {
      result.push({ clientId: client.id, clientName: name, reasons });
    }
  });

  return {
    count: result.length,
    clients: result,
  };
}
