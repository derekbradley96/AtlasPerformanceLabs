/**
 * Client gym & equipment. Per clientId. Used in onboarding / client profile edit and shown in Client Detail.
 *
 * Server-backed via clients.gym_equipment_json (RLS lets both the coach and the
 * athlete update the row). localStorage is only a per-device cache: the client
 * edits equipment on THEIR device and the coach reads it on THEIRS, so a
 * local-only store never crosses over. Call fetchClientGym() on mount to pull
 * the server copy into the cache; sync getClientGym() reads stay cheap.
 */
import { getSupabase } from '@/lib/supabaseClient';

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

/** Get gym/equipment for a client (device cache; see fetchClientGym for the server copy). */
export function getClientGym(clientId) {
  const map = safeParse({});
  const raw = map[clientId];
  if (!raw) return null;
  return { ...DEFAULT_EQUIPMENT, ...raw };
}

/** Fetch gym/equipment from the server into the cache. Falls back to the cache offline. */
export async function fetchClientGym(clientId) {
  if (!clientId) return null;
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('gym_equipment_json')
        .eq('id', clientId)
        .maybeSingle();
      if (!error && data && data.gym_equipment_json && typeof data.gym_equipment_json === 'object') {
        const map = safeParse({});
        map[clientId] = data.gym_equipment_json;
        safeSet(map);
        return { ...DEFAULT_EQUIPMENT, ...data.gym_equipment_json };
      }
    } catch (e) {
      if (import.meta.env?.DEV) console.warn('[gymEquipmentStore] fetch failed', e?.message);
    }
  }
  return getClientGym(clientId);
}

/** Set gym/equipment for a client: cache + best-effort server write. */
export function setClientGym(clientId, data) {
  const map = safeParse({});
  map[clientId] = {
    gymName: data.gymName ?? '',
    ...DEFAULT_EQUIPMENT,
    ...data,
    updated_date: new Date().toISOString(),
  };
  safeSet(map);
  const supabase = getSupabase();
  if (supabase && clientId) {
    supabase
      .from('clients')
      .update({ gym_equipment_json: map[clientId] })
      .eq('id', clientId)
      .then(({ error }) => {
        if (error && import.meta.env?.DEV) console.warn('[gymEquipmentStore] server sync failed', error.message);
      });
  }
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
