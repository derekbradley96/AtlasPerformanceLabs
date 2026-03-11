/**
 * Local check-ins repo. Uses Capacitor Preferences / localStorage via getJSON/setJSON.
 * Key: atlas_checkins_v1. All check-ins in one array; filter by trainer_id.
 */

import * as storage from '@/lib/persistence/storage';
import type { CheckIn } from '@/data/models';

const KEY = 'atlas_checkins_v1';

function isCheckInRow(row: unknown): row is CheckIn & { checkin_date?: string } {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.trainer_id === 'string' &&
    typeof r.client_id === 'string' &&
    (typeof r.checkin_date === 'string' || typeof r.created_at === 'string' || typeof r.created_date === 'string')
  );
}

async function loadAll(): Promise<CheckIn[]> {
  const raw = await storage.getJSON(KEY, null);
  const list = Array.isArray(raw) ? raw : [];
  return list.filter(isCheckInRow) as CheckIn[];
}

async function saveAll(list: CheckIn[]): Promise<void> {
  const arr = Array.isArray(list) ? list.filter(isCheckInRow) : [];
  await storage.setJSON(KEY, arr);
}

function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `checkin-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export async function listByClient(trainerId: string, clientId: string): Promise<CheckIn[]> {
  if (!trainerId || !clientId) return [];
  const all = await loadAll();
  const dateKey = (c: CheckIn) => c.checkin_date ?? c.created_at ?? c.created_date ?? '';
  return all
    .filter((c) => c.trainer_id === trainerId && c.client_id === clientId)
    .sort((a, b) => dateKey(b).localeCompare(dateKey(a)));
}

export async function listForTrainer(trainerId: string): Promise<CheckIn[]> {
  if (!trainerId) return [];
  const all = await loadAll();
  const dateKey = (c: CheckIn) => c.checkin_date ?? c.created_at ?? c.created_date ?? '';
  return all
    .filter((c) => c.trainer_id === trainerId)
    .sort((a, b) => dateKey(b).localeCompare(dateKey(a)));
}

export async function getLatestByClientIds(
  trainerId: string,
  clientIds: string[]
): Promise<Record<string, CheckIn>> {
  const ids = Array.isArray(clientIds) ? clientIds.filter((id): id is string => typeof id === 'string') : [];
  if (!trainerId || ids.length === 0) return {};

  const all = await loadAll();
  const dateKey = (c: CheckIn) => c.checkin_date ?? c.created_at ?? c.created_date ?? '';
  const forTrainer = all.filter((c) => c.trainer_id === trainerId && ids.includes(c.client_id));
  forTrainer.sort((a, b) => dateKey(b).localeCompare(dateKey(a)));

  const map: Record<string, CheckIn> = {};
  for (const row of forTrainer) {
    const cid = row.client_id;
    if (cid && !map[cid]) map[cid] = row;
  }
  return map;
}

export async function upsert(
  trainerId: string,
  payload: Partial<CheckIn> & { client_id: string; checkin_date: string }
): Promise<CheckIn> {
  const all = await loadAll();
  const clientId = payload.client_id;
  const checkinDate = payload.checkin_date;
  const existingIdx = all.findIndex(
    (c) =>
      c.trainer_id === trainerId && c.client_id === clientId && ((c as { checkin_date?: string }).checkin_date === checkinDate || c.checkin_date === checkinDate)
  );

  const now = new Date().toISOString();
  const existing = existingIdx >= 0 ? all[existingIdx] : null;
  const row: CheckIn = {
    ...existing,
    ...payload,
    id: payload.id ?? existing?.id ?? genId(),
    trainer_id: trainerId,
    client_id: clientId,
    checkin_date: checkinDate,
    created_at: existing?.created_at ?? now,
    created_date: existing?.created_date ?? now,
    updated_at: now,
  } as CheckIn;

  if (existingIdx >= 0) {
    all[existingIdx] = row;
  } else {
    all.push(row);
  }
  await saveAll(all);
  return row;
}

export async function remove(trainerId: string, checkinId: string): Promise<void> {
  if (!checkinId) return;
  const all = await loadAll();
  const next = all.filter((c) => !(c.trainer_id === trainerId && c.id === checkinId));
  if (next.length < all.length) await saveAll(next);
}
