/**
 * Trainer capacity persistence (localStorage). Keyed by trainerId.
 * Capacity dashboard and capacityService read from here when available.
 */
import type { TrainerCapacity } from './trainerFoundationTypes';

const KEY = 'atlas_trainer_capacity';
const DEFAULT_DAILY_ADMIN_LIMIT_MINUTES = 60;

function safeGet(): Record<string, TrainerCapacity> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function safeSet(map: Record<string, TrainerCapacity>) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(map));
  } catch {}
}

export function getTrainerCapacity(trainerId: string): TrainerCapacity | null {
  const map = safeGet();
  return map[trainerId] ?? null;
}

export function setTrainerCapacity(trainerId: string, payload: Partial<Omit<TrainerCapacity, 'trainerId' | 'updatedAt'>>): TrainerCapacity {
  const now = new Date().toISOString();
  const map = safeGet();
  const current = map[trainerId];
  const next: TrainerCapacity = {
    trainerId,
    maxClients: payload.maxClients ?? current?.maxClients,
    dailyAdminLimitMinutes:
      typeof payload.dailyAdminLimitMinutes === 'number'
        ? payload.dailyAdminLimitMinutes
        : (current?.dailyAdminLimitMinutes ?? DEFAULT_DAILY_ADMIN_LIMIT_MINUTES),
    updatedAt: now,
  };
  map[trainerId] = next;
  safeSet(map);
  return next;
}

/** Daily admin limit for a trainer (from foundation or fallback). */
export function getDailyAdminLimitMinutesForTrainer(trainerId: string): number {
  const cap = getTrainerCapacity(trainerId);
  const v = cap?.dailyAdminLimitMinutes;
  return typeof v === 'number' && v > 0 ? v : DEFAULT_DAILY_ADMIN_LIMIT_MINUTES;
}
