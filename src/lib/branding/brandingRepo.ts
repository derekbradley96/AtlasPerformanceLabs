/**
 * Trainer branding persistence (localStorage). Swap to API later.
 */
import type { TrainerBranding } from './brandingTypes';

const KEY = 'atlas_trainer_branding';

function safeGet(): Record<string, TrainerBranding> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function safeSet(map: Record<string, TrainerBranding>) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY, JSON.stringify(map));
    }
  } catch {}
}

const DEFAULT_ACCENT = '#3B82F6';
const DEFAULT_PRIMARY = '#0B1220';

export function getBranding(trainerId: string): TrainerBranding {
  const map = safeGet();
  const stored = map[trainerId];
  if (stored) return { ...stored };
  return {
    trainerId,
    primaryColor: DEFAULT_PRIMARY,
    accentColor: DEFAULT_ACCENT,
  };
}

export function saveBranding(trainerId: string, branding: Partial<Omit<TrainerBranding, 'trainerId'>>) {
  const map = safeGet();
  const current = map[trainerId] ?? { trainerId, primaryColor: DEFAULT_PRIMARY, accentColor: DEFAULT_ACCENT };
  map[trainerId] = { ...current, ...branding, trainerId };
  safeSet(map);
  return map[trainerId];
}
