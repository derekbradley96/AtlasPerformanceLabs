/**
 * Trainer profile persistence (localStorage). Keyed by trainerId.
 */
import type { TrainerProfile, FocusType, TrainerPortfolioItem, TrainerProfileService } from './trainerFoundationTypes';

const KEY = 'atlas_trainer_profile';

function safeGet(): Record<string, TrainerProfile> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function safeSet(map: Record<string, TrainerProfile>) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(map));
  } catch {}
}

export function getTrainerProfile(trainerId: string): TrainerProfile | null {
  const map = safeGet();
  return map[trainerId] ?? null;
}

export function setTrainerProfile(trainerId: string, payload: Partial<Omit<TrainerProfile, 'trainerId' | 'updatedAt'>>): TrainerProfile {
  const now = new Date().toISOString();
  const map = safeGet();
  const current = map[trainerId];
  const next: TrainerProfile = {
    trainerId,
    user_id: payload.user_id ?? current?.user_id ?? trainerId,
    focusType: (payload.focusType ?? current?.focusType ?? 'general') as FocusType,
    displayName: payload.displayName ?? current?.displayName,
    onboardingComplete: payload.onboardingComplete ?? current?.onboardingComplete ?? false,
    updatedAt: now,
    profileImage: payload.profileImage !== undefined ? payload.profileImage : current?.profileImage,
    bannerImage: payload.bannerImage !== undefined ? payload.bannerImage : current?.bannerImage,
    username: payload.username !== undefined ? payload.username : current?.username,
    bio: payload.bio !== undefined ? payload.bio : current?.bio,
    specialties: payload.specialties !== undefined ? payload.specialties : current?.specialties,
    yearsCoaching: payload.yearsCoaching !== undefined ? payload.yearsCoaching : current?.yearsCoaching,
    credentials: payload.credentials !== undefined ? payload.credentials : current?.credentials,
    timezone: payload.timezone !== undefined ? payload.timezone : current?.timezone,
    workingHours: payload.workingHours !== undefined ? payload.workingHours : current?.workingHours,
    responseTime: payload.responseTime !== undefined ? payload.responseTime : current?.responseTime,
    trainerPortfolio: payload.trainerPortfolio !== undefined ? payload.trainerPortfolio : current?.trainerPortfolio,
    services: payload.services !== undefined ? payload.services : current?.services,
  };
  map[trainerId] = next;
  safeSet(map);
  return next;
}

export function setOnboardingComplete(trainerId: string): TrainerProfile {
  return setTrainerProfile(trainerId, { onboardingComplete: true });
}

/** Get trainer profile by public username (for /coach/:username). */
export function getTrainerProfileByUsername(username: string): TrainerProfile | null {
  const map = safeGet();
  const normalized = (username || '').trim().toLowerCase();
  if (!normalized) return null;
  for (const key of Object.keys(map)) {
    const p = map[key];
    if ((p.username || '').trim().toLowerCase() === normalized) return p;
  }
  return null;
}
