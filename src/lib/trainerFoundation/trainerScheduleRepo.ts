/**
 * Trainer working hours persistence (localStorage). Keyed by trainerId.
 */
import type { TrainerSchedule, DayWindow } from './trainerFoundationTypes';

const KEY = 'atlas_trainer_schedule';

function safeGet(): Record<string, TrainerSchedule> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function safeSet(map: Record<string, TrainerSchedule>) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(map));
  } catch {}
}

export function getTrainerSchedule(trainerId: string): TrainerSchedule {
  const map = safeGet();
  const stored = map[trainerId];
  if (stored) return { ...stored, windows: [...(stored.windows || [])] };
  return {
    trainerId,
    windows: [],
    updatedAt: new Date(0).toISOString(),
  };
}

export function setTrainerSchedule(trainerId: string, payload: { windows: DayWindow[]; timezone?: string }): TrainerSchedule {
  const now = new Date().toISOString();
  const map = safeGet();
  map[trainerId] = {
    trainerId,
    windows: payload.windows.map((w) => ({ ...w })),
    timezone: payload.timezone,
    updatedAt: now,
  };
  safeSet(map);
  return map[trainerId];
}
