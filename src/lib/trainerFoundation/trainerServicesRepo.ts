/**
 * Trainer services persistence (localStorage). Keyed by trainerId.
 */
import type { TrainerServices, TrainerService } from './trainerFoundationTypes';

const KEY = 'atlas_trainer_services';

function safeGet(): Record<string, TrainerServices> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function safeSet(map: Record<string, TrainerServices>) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(map));
  } catch {}
}

export function getTrainerServices(trainerId: string): TrainerServices {
  const map = safeGet();
  const stored = map[trainerId];
  if (stored) return { ...stored, services: [...(stored.services || [])] };
  return {
    trainerId,
    services: [],
    updatedAt: new Date(0).toISOString(),
  };
}

export function setTrainerServices(trainerId: string, services: TrainerService[]): TrainerServices {
  const now = new Date().toISOString();
  const map = safeGet();
  map[trainerId] = { trainerId, services: services.map((s) => ({ ...s })), updatedAt: now };
  safeSet(map);
  return map[trainerId];
}
