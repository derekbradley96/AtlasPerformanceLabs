/**
 * Local / sandbox / mock sources for inbox, closeout, risk, and review feeds.
 * Replaces direct imports from selectors.js for active coach paths (no demo selector store in production).
 */
import { safeDate } from '@/lib/format';
import * as sandbox from '@/lib/sandboxStore';
import * as localClientsStore from '@/data/localClientsStore';
import { clients as mockClients, checkIns as mockCheckIns } from '@/data/mockData';
import { getStubClients } from '@/lib/clientStubStore';
import { getSeedClients, getSeedCheckIns } from '@/lib/seedClientStore';
import { getIntakeRequestMessages } from '@/lib/intake/intakeRequestMessageStore';
import { getClientById as getSyncClientFromService } from '@/data/clientsService';

function toUIShape(c) {
  if (!c || typeof c !== 'object') return c;
  return {
    ...c,
    full_name: c.full_name ?? c.name ?? '',
    created_date: c.created_date ?? c.created_at ?? c.created_date,
    trainer_id: c.trainer_id ?? c.coach_id ?? '',
  };
}

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

/** Single client: Supabase-synced local row, then sandbox profile (demo / offline). */
export function resolveClientRecord(clientId) {
  if (clientId == null || clientId === '') return null;
  return getSyncClientFromService(clientId) || sandbox.getClientById(clientId);
}

/**
 * Clients for a coach id: local store + sandbox + mock/stub/seed (deduped by id).
 * Does not call selectors.js.
 */
export function getTrainerClientsList(trainerId) {
  if (trainerId == null || trainerId === '') return [];
  const byId = new Map();

  const tryAdd = (c) => {
    if (!c?.id) return;
    const tid = c.trainer_id ?? c.coach_id;
    if (String(tid) !== String(trainerId)) return;
    const shaped = toUIShape(c);
    byId.set(c.id, shaped);
  };

  try {
    const raw = typeof localClientsStore.loadClients === 'function' ? localClientsStore.loadClients() : null;
    const list = Array.isArray(raw)
      ? raw
      : typeof localClientsStore.getSyncCache === 'function'
        ? localClientsStore.getSyncCache() ?? []
        : [];
    (Array.isArray(list) ? list : []).forEach(tryAdd);
  } catch {
    /* ignore */
  }

  (sandbox.listClients(trainerId) ?? []).forEach(tryAdd);
  [...mockClients, ...getStubClients(), ...getSeedClients()].forEach(tryAdd);
  return [...byId.values()];
}

/** Submitted check-ins needing review (sandbox reviewCompleted + merged mock/seed rows). */
export function getSubmittedCheckInsNeedingReview() {
  const state = sandbox.getState();
  const reviewCompleted = Array.isArray(state.reviewCompleted) ? state.reviewCompleted : [];
  const merged = [...mockCheckIns, ...getSeedCheckIns(), ...(Array.isArray(state.checkIns) ? state.checkIns : [])];
  const byId = new Map();
  merged.forEach((row) => {
    if (!row?.id) return;
    const n = normalizeCheckIn(row);
    if (n) byId.set(row.id, n);
  });
  return [...byId.values()]
    .filter((c) => c?.status === 'submitted' && !reviewCompleted.includes(c.id))
    .sort(
      (a, b) =>
        (safeDate(b?.submitted_at || b?.created_date)?.getTime() ?? 0) -
        (safeDate(a?.submitted_at || a?.created_date)?.getTime() ?? 0)
    );
}

/** Check-ins for one client: sandbox + mock + seed, normalized, newest first. */
export function listClientCheckInsForInbox(clientId) {
  if (!clientId) return [];
  const fromSandbox = sandbox.listCheckIns(clientId) || [];
  const fromMock = mockCheckIns.filter((c) => c.client_id === clientId);
  const fromSeed = getSeedCheckIns().filter((c) => c.client_id === clientId);
  const byId = new Map();
  [...fromMock, ...fromSeed, ...fromSandbox].forEach((row) => {
    if (!row?.id) return;
    const n = normalizeCheckIn(row);
    if (n) byId.set(row.id, n);
  });
  return [...byId.values()].sort(
    (a, b) =>
      (safeDate(b?.submitted_at || b?.created_date)?.getTime() ?? 0) -
      (safeDate(a?.submitted_at || a?.created_date)?.getTime() ?? 0)
  );
}

export function getInboxThreadsForTrainer(trainerId) {
  const raw = sandbox.listThreads(trainerId);
  return Array.isArray(raw) ? raw : [];
}

export function getInboxThreadByClientId(clientId) {
  return sandbox.getThreadByClientId(clientId) ?? null;
}

export function getInboxMessagesByClientId(clientId) {
  const fromSandbox = Array.isArray(sandbox.listMessages(clientId)) ? sandbox.listMessages(clientId) : [];
  const fromIntakeRaw = typeof getIntakeRequestMessages === 'function' ? getIntakeRequestMessages() : [];
  const fromIntake = Array.isArray(fromIntakeRaw) ? fromIntakeRaw.filter((m) => m?.client_id === clientId) : [];
  const combined = [...fromSandbox, ...fromIntake];
  return combined.sort(
    (a, b) => (safeDate(a?.created_date)?.getTime() ?? 0) - (safeDate(b?.created_date)?.getTime() ?? 0)
  );
}

export function listPaymentsForInbox(clientId) {
  if (!clientId) return [];
  return Array.isArray(sandbox.listPayments(clientId)) ? sandbox.listPayments(clientId) : [];
}

export function getMessageThreadsRowForClient(clientId) {
  const t = getInboxThreadByClientId(clientId);
  if (!t) return [];
  return [
    {
      id: t.id,
      client_id: t.client_id,
      trainer_id: t.trainer_id,
      last_message_at: t.last_message_at,
      unread_count: t.unread_count ?? 0,
    },
  ];
}
