/**
 * Synchronous selectors over client data. Clients from unified local store (atlas_clients_v1).
 */
import { safeDate } from '@/lib/format';
import { getCurrentTrainerId } from '@/lib/sandboxTrainerId';
import * as sandbox from '@/lib/sandboxStore';
import * as localClientsStore from '@/data/localClientsStore';
import { getClientById as getClientByIdFromService } from '@/data/clientsService';
import { getCheckinReviewed } from '@/lib/checkinReviewStorage';
import { getCompPrepClientOverrides, getClientPhotosOverride } from '@/lib/compPrepStore';
import { getClientIntakeProfile } from '@/lib/intake/clientIntakeProfileStore';
import { getIntakeRequestMessages } from '@/lib/intake/intakeRequestMessageStore';

function toUIShape(c) {
  if (!c || typeof c !== 'object') return c;
  return {
    ...c,
    full_name: c.full_name ?? c.name ?? '',
    created_date: c.created_date ?? c.created_at ?? c.created_date,
  };
}

export function getClients() {
  const trainerId = getCurrentTrainerId();
  let list = [];
  try {
    const raw = localClientsStore.loadClients?.();
    if (Array.isArray(raw)) list = raw;
    else if (typeof localClientsStore.getSyncCache === 'function') list = localClientsStore.getSyncCache() ?? [];
  } catch (e) {
    if (import.meta.env?.DEV) console.warn('[selectors] getClients', e?.message);
  }
  const filtered = !trainerId ? list : list.filter((c) => c && c.trainer_id === trainerId);
  return filtered.map(toUIShape);
}

export function getClientById(id) {
  if (id == null || id === '') return null;
  let client;
  try {
    client = getClientByIdFromService(id);
  } catch (e) {
    if (import.meta.env?.DEV) console.warn('[selectors] getClientById', e?.message);
    return null;
  }
  if (!client || typeof client !== 'object' || Array.isArray(client) || client.id == null) return null;
  try {
    const overrides = getCompPrepClientOverrides(id);
    const intakeProfile = getClientIntakeProfile(id);
    let out = overrides ? { ...client, ...overrides } : client;
    if (intakeProfile) out = { ...out, ...intakeProfile };
    return out;
  } catch (e) {
    if (import.meta.env?.DEV) console.warn('[selectors] getClientById overrides/intake', e?.message);
    return client;
  }
}

/** Clients in comp prep: have federation/division/prepPhase or showDate set (or overrides). */
export function getPrepClients() {
  const list = (getClients() ?? []).filter((c) => {
    const o = getCompPrepClientOverrides(c?.id);
    const rec = o ? { ...c, ...o } : (c ?? {});
    return rec.federation || rec.division || rec.prepPhase || rec.showDate;
  });
  return (list ?? []).map((c) => getClientById(c?.id)).filter(Boolean);
}

/** Get client record by linked user_id (for current user as client). */
export function getClientByUserId(userId) {
  return (getClients() ?? []).find((c) => c?.user_id === userId) ?? null;
}

/** Normalize a check-in row to canonical CheckIn shape (matches repo/service). */
function normalizeCheckIn(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    ...row,
    created_at: row.created_at ?? row.checkin_date ?? null,
    created_date: row.created_date ?? row.created_at ?? row.checkin_date ?? null,
    status: row.status ?? 'submitted',
    flags: Array.isArray(row.flags) ? row.flags : [],
  };
}

export function getClientCheckIns(clientId) {
  const list = Array.isArray(sandbox.listCheckIns(clientId)) ? sandbox.listCheckIns(clientId) : [];
  const normalized = list.map(normalizeCheckIn).filter(Boolean);
  return normalized.sort((a, b) => (safeDate(b?.created_date || b?.submitted_at)?.getTime() ?? 0) - (safeDate(a?.created_date || a?.submitted_at)?.getTime() ?? 0));
}

/** Check-in needs review if submitted and not yet marked reviewed. */
export function isCheckinNeedsReview(checkin) {
  if (!checkin || checkin.status !== 'submitted') return false;
  return !getCheckinReviewed(checkin.id);
}

/** All check-ins that need review (any client), sorted by submitted_at desc. */
export function getNeedsReviewCheckIns() {
  const state = sandbox.getState();
  const checkIns = Array.isArray(state.checkIns) ? state.checkIns : [];
  const reviewCompleted = Array.isArray(state.reviewCompleted) ? state.reviewCompleted : [];
  const normalized = checkIns.map(normalizeCheckIn).filter(Boolean);
  return normalized
    .filter((c) => c?.status === 'submitted' && !reviewCompleted.includes(c.id))
    .sort((a, b) => (safeDate(b?.submitted_at || b?.created_date)?.getTime() ?? 0) - (safeDate(a?.submitted_at || a?.created_date)?.getTime() ?? 0));
}

/** Count of check-ins needing review. */
export function getNeedsReviewCount() {
  return getNeedsReviewCheckIns().length;
}

/** Client IDs that have at least one check-in needing review. */
export function getClientIdsWithNeedsReview() {
  return [...new Set(getNeedsReviewCheckIns().map((c) => c.client_id))];
}

/** Client IDs that have at least one check-in with status 'pending' (e.g. due today). */
export function getClientIdsWithPendingCheckIns() {
  const state = sandbox.getState();
  const checkIns = Array.isArray(state.checkIns) ? state.checkIns : [];
  return [...new Set(checkIns.filter((c) => c?.status === 'pending').map((c) => c?.client_id).filter(Boolean))];
}

export function getClientPrograms(clientId) {
  const trainerId = getCurrentTrainerId();
  const list = Array.isArray(sandbox.listPrograms(trainerId)) ? sandbox.listPrograms(trainerId) : [];
  return list.filter((p) => p?.client_id === clientId);
}

export function getThreadByClientId(clientId) {
  return sandbox.getThreadByClientId(clientId) ?? null;
}

/** All threads for a trainer (e.g. for inbox). */
export function getThreadsForTrainer(trainerId) {
  return Array.isArray(sandbox.listThreads(trainerId)) ? sandbox.listThreads(trainerId) : [];
}

/** Messages for a thread (client). Merges sandbox messages with intake-request messages. Sorted by created_date ascending. */
export function getMessagesByClientId(clientId) {
  const fromSandbox = Array.isArray(sandbox.listMessages(clientId)) ? sandbox.listMessages(clientId) : [];
  const fromIntakeRaw = typeof getIntakeRequestMessages === 'function' ? getIntakeRequestMessages() : [];
  const fromIntake = Array.isArray(fromIntakeRaw) ? fromIntakeRaw.filter((m) => m?.client_id === clientId) : [];
  const combined = [...fromSandbox, ...fromIntake];
  return combined.sort((a, b) => (safeDate(a?.created_date)?.getTime() ?? 0) - (safeDate(b?.created_date)?.getTime() ?? 0));
}

/** Photos for a client. Sandbox photos + localStorage override. */
export function getClientPhotos(clientId) {
  const fromStore = getClientPhotosOverride(clientId);
  if (fromStore != null) return fromStore;
  const state = sandbox.getState();
  const list = Array.isArray(state.photos) ? state.photos : [];
  return list.filter((p) => p?.client_id === clientId).sort((a, b) => (safeDate(b?.created_at)?.getTime() ?? 0) - (safeDate(a?.created_at)?.getTime() ?? 0));
}

/** Payments for a client (status: paid | pending | overdue). */
export function getPaymentsForClient(clientId) {
  if (!clientId) return [];
  return Array.isArray(sandbox.listPayments(clientId)) ? sandbox.listPayments(clientId) : [];
}

/** Message thread for client (single thread per client). Return as array for health score API. */
export function getMessageThreadsForClient(clientId) {
  const t = getThreadByClientId(clientId);
  if (!t) return [];
  return [{ id: t.id, client_id: t.client_id, trainer_id: t.trainer_id, last_message_at: t.last_message_at, unread_count: t.unread_count ?? 0 }];
}
