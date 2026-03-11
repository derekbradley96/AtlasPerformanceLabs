/**
 * Trainer policies persistence (localStorage). Keyed by trainerId.
 */
import type { TrainerPolicies } from './trainerFoundationTypes';

const KEY = 'atlas_trainer_policies';

function safeGet(): Record<string, TrainerPolicies> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function safeSet(map: Record<string, TrainerPolicies>) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(map));
  } catch {}
}

export function getTrainerPolicies(trainerId: string): TrainerPolicies | null {
  const map = safeGet();
  return map[trainerId] ?? null;
}

export function setTrainerPolicies(trainerId: string, payload: Partial<Omit<TrainerPolicies, 'trainerId' | 'updatedAt'>>): TrainerPolicies {
  const now = new Date().toISOString();
  const map = safeGet();
  const current = map[trainerId];
  const next: TrainerPolicies = {
    trainerId,
    cancellationHours: payload.cancellationHours ?? current?.cancellationHours,
    latePolicy: payload.latePolicy ?? current?.latePolicy,
    paymentTerms: payload.paymentTerms ?? current?.paymentTerms,
    updatedAt: now,
  };
  map[trainerId] = next;
  safeSet(map);
  return next;
}
