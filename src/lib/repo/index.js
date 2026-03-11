/**
 * Single repo interface for the app.
 * Clients + check-ins: Supabase-first when session exists. Threads/messages: Supabase-first via messagingService, fallback sandbox/local.
 */

import * as sandbox from '@/lib/sandboxStore';
import * as clientsService from '@/data/clientsService';
import * as checkinsService from '@/data/checkInsService';
import * as nutritionPlansService from '@/data/nutritionPlansService';
import * as messagingService from '@/data/messagingService';

function safeArray(x) {
  return Array.isArray(x) ? x : [];
}

function safeDate(x) {
  if (x == null) return null;
  if (typeof x === 'string' && x.length > 0) return x;
  try {
    const d = new Date(x);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

/** Normalize client so UI always has full_name and name (Supabase has name only). */
function normalizeClient(row) {
  if (!row || typeof row !== 'object') return row;
  const full_name = String(row.full_name ?? row.name ?? '').trim() || 'Client';
  const name = String(row.name ?? row.full_name ?? '').trim() || full_name;
  return {
    ...row,
    full_name,
    name,
  };
}

/** Normalize check-in row to canonical CheckIn shape. All check-in data must pass through this before reaching UI. */
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

export const repo = {
  clients: {
    list(trainerId, isDemoMode = false) {
      return clientsService.getClients(trainerId, { isDemoMode }).then((list) => (Array.isArray(list) ? list.map(normalizeClient) : []));
    },
    get(id, trainerId, isDemoMode = false) {
      if (trainerId) {
        return clientsService.getClientAsync(trainerId, id, { isDemoMode }).then((c) => (c ? normalizeClient(c) : null));
      }
      const c = clientsService.getClientById(id);
      return Promise.resolve(c ? normalizeClient(c) : null);
    },
    create(trainerId, payload, isDemoMode = false) {
      return clientsService.addClientForTrainer(trainerId, payload ?? {}, { isDemoMode }).then((client) => {
        if (client && trainerId) sandbox.addClient(trainerId, client);
        return client ? normalizeClient(client) : null;
      });
    },
    update(id, patch, trainerId, isDemoMode = false) {
      const tid = trainerId ?? clientsService.getClientById(id)?.trainer_id ?? 'local-trainer';
      return clientsService.updateClient(tid, id, patch ?? {}, { isDemoMode }).then((c) => (c ? normalizeClient(c) : null));
    },
    delete(id, trainerId, isDemoMode = false) {
      const tid = trainerId ?? clientsService.getClientById(id)?.trainer_id ?? 'local-trainer';
      return clientsService.deleteClient(tid, id, { isDemoMode }).then(() => sandbox.deleteClient(id));
    },
  },
  threads: {
    list(trainerId) {
      return messagingService.listThreads(trainerId ?? 'local-trainer');
    },
    getByClientId(clientId, trainerId) {
      return messagingService.getThreadByClientId(clientId, trainerId ?? 'local-trainer').then((t) => t ?? null);
    },
    ensureThreadForClient(clientId, trainerId) {
      return messagingService.ensureThreadForClient(clientId, trainerId ?? 'local-trainer');
    },
    async deleteByClientId(clientId, trainerId) {
      if (!clientId) return;
      await messagingService.deleteThreadByClientId(clientId, trainerId ?? 'local-trainer');
    },
  },
  messages: {
    list(threadIdOrClientId, trainerId) {
      return messagingService.listMessages(threadIdOrClientId, trainerId ?? 'local-trainer');
    },
    add(threadIdOrClientId, message, trainerId) {
      const text = message?.body ?? message?.text ?? '';
      return messagingService.sendMessage(threadIdOrClientId, text, trainerId ?? 'local-trainer').then((m) => m ?? null);
    },
    addVoice(threadIdOrClientId, { blob, mimeType, durationMs }, trainerId) {
      return messagingService.sendVoiceMessage(threadIdOrClientId, { blob, mimeType, durationMs }, trainerId ?? 'local-trainer').then((m) => m ?? null);
    },
  },
  programs: {
    list(trainerIdOrClientId) {
      return Promise.resolve(safeArray(sandbox.listPrograms(trainerIdOrClientId)));
    },
    add(payload) {
      const program = sandbox.addProgram(payload);
      return Promise.resolve(program);
    },
    assignToClient(clientId, programId) {
      sandbox.assignProgramToClient(clientId, programId);
      return Promise.resolve();
    },
  },
  checkIns: {
    /** @returns {Promise<import('@/data/models').CheckIn[]>} */
    list(clientId, trainerId) {
      const tid = trainerId ?? 'local-trainer';
      return checkinsService.listByClient(tid, clientId).then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        return list.map(normalizeCheckIn).filter(Boolean);
      });
    },
    /** @returns {Promise<import('@/data/models').CheckIn[]>} */
    listForTrainer(trainerId) {
      return checkinsService.listForTrainer(trainerId).then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        return list.map(normalizeCheckIn).filter(Boolean);
      });
    },
    add(clientId, payload, trainerId) {
      const tid = trainerId ?? 'local-trainer';
      const checkinDate = (payload && payload.checkin_date) || new Date().toISOString().slice(0, 10);
      return checkinsService.upsert(tid, { client_id: clientId, checkin_date: checkinDate, ...payload }).then((c) => c ?? null);
    },
  },
  getCoach(trainerId) {
    const state = sandbox.getState();
    const t = (state.trainers || []).find((x) => x.id === trainerId);
    if (t) return Promise.resolve({ id: t.id, name: t.full_name, full_name: t.full_name, email: t.email });
    return Promise.resolve({ id: trainerId, name: 'Trainer', full_name: 'Trainer', email: '' });
  },
  inbox: {
    list(trainerId) {
      const items = sandbox.getInboxItems(trainerId);
      return Promise.resolve({
        active: safeArray(items?.active),
        waiting: safeArray(items?.waiting),
        done: safeArray(items?.done),
      });
    },
    completeReviewItem(id) {
      sandbox.completeReviewItem(id);
      return Promise.resolve();
    },
  },
  markThreadRead(threadIdOrClientId) {
    sandbox.markThreadRead(threadIdOrClientId);
    return Promise.resolve();
  },
  markAllThreadsRead() {
    sandbox.markAllThreadsRead();
    return Promise.resolve();
  },
  getUnreadCountTotal(trainerId) {
    return Promise.resolve(sandbox.getUnreadCountTotal(trainerId) ?? 0);
  },
  nutrition: {
    getActivePlan(trainerId, clientId) {
      return nutritionPlansService.getActiveNutritionPlan(trainerId, clientId);
    },
    upsert(payload) {
      return nutritionPlansService.upsertNutritionPlan(payload);
    },
  },
};

export default repo;
