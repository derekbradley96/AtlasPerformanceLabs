/**
 * Client gym & equipment. Per clientId. Used in onboarding / client profile edit and shown in Client Detail.
 */
const KEY = 'atlas_client_gym';

function safeParse(fallback) {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function safeSet(value) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch (e) {}
}

const DEFAULT_EQUIPMENT = {
  rack: false,
  smith: false,
  cables: false,
  hackSquat: false,
  dbMax: '',
  machinesNotes: '',
};

/** Get gym/equipment for a client. */
export function getClientGym(clientId) {
  const map = safeParse({});
  const raw = map[clientId];
  if (!raw) return null;
  return { ...DEFAULT_EQUIPMENT, ...raw };
}

/** Set gym/equipment for a client. */
export function setClientGym(clientId, data) {
  const map = safeParse({});
  map[clientId] = {
    gymName: data.gymName ?? '',
    ...DEFAULT_EQUIPMENT,
    ...data,
    updated_date: new Date().toISOString(),
  };
  safeSet(map);
  return map[clientId];
}

export const EQUIPMENT_LABELS = {
  rack: 'Power rack / Squat rack',
  smith: 'Smith machine',
  cables: 'Cable station',
  hackSquat: 'Hack squat / Leg press',
  dbMax: 'Dumbbell max (kg)',
  machinesNotes: 'Other machines / notes',
};
