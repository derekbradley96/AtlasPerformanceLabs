/**
 * Persist client detail UI state: quick notes, coach notes (trainer-only), and "marked paid" (overrides mock payment_overdue for display).
 *
 * Notes are server-backed via coach_client_notes (coach-private RLS) so they
 * survive browser clears and sync across the coach's devices. localStorage is
 * a per-device cache; call fetchClientDetailNotes() on mount to hydrate it.
 * "Marked paid" stays local — it is a display-only override.
 */
import { getSupabase } from '@/lib/supabaseClient';

const NOTES_PREFIX = 'atlas_client_notes_';
const COACH_NOTES_PREFIX = 'atlas_coach_notes_';
const PAID_PREFIX = 'atlas_client_paid_';

function cacheGet(key) {
  try {
    return localStorage.getItem(key) || '';
  } catch (e) {
    return '';
  }
}

function cacheSet(key, text) {
  try {
    localStorage.setItem(key, String(text));
  } catch (e) {}
}

function syncNotesToServer(coachId, clientId, patch) {
  const supabase = getSupabase();
  if (!supabase || !coachId || !clientId) return;
  supabase
    .from('coach_client_notes')
    .upsert(
      { coach_id: coachId, client_id: clientId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'coach_id,client_id' }
    )
    .then(({ error }) => {
      if (error && import.meta.env?.DEV) console.warn('[clientDetailStorage] notes sync failed', error.message);
    });
}

/**
 * Pull both notes from the server into the cache. Falls back to cached values
 * offline. Returns { quickNotes, coachNotes } or null when nothing is stored.
 */
export async function fetchClientDetailNotes(clientId, coachId) {
  if (!clientId) return null;
  const supabase = getSupabase();
  if (supabase && coachId) {
    try {
      const { data, error } = await supabase
        .from('coach_client_notes')
        .select('quick_notes, coach_notes')
        .eq('coach_id', coachId)
        .eq('client_id', clientId)
        .maybeSingle();
      if (!error && data) {
        if (data.quick_notes != null) cacheSet(NOTES_PREFIX + clientId, data.quick_notes);
        if (data.coach_notes != null) cacheSet(COACH_NOTES_PREFIX + clientId, data.coach_notes);
        return { quickNotes: data.quick_notes ?? '', coachNotes: data.coach_notes ?? '' };
      }
    } catch (e) {
      if (import.meta.env?.DEV) console.warn('[clientDetailStorage] notes fetch failed', e?.message);
    }
  }
  const quickNotes = cacheGet(NOTES_PREFIX + clientId);
  const coachNotes = cacheGet(COACH_NOTES_PREFIX + clientId);
  return quickNotes || coachNotes ? { quickNotes, coachNotes } : null;
}

export function getClientNotes(clientId) {
  if (!clientId) return '';
  return cacheGet(NOTES_PREFIX + clientId);
}

export function setClientNotes(clientId, text, coachId = null) {
  if (!clientId) return;
  cacheSet(NOTES_PREFIX + clientId, String(text));
  syncNotesToServer(coachId, clientId, { quick_notes: String(text) });
}

export function getCoachNotes(clientId) {
  if (!clientId) return '';
  return cacheGet(COACH_NOTES_PREFIX + clientId);
}

export function setCoachNotes(clientId, text, coachId = null) {
  if (!clientId) return;
  cacheSet(COACH_NOTES_PREFIX + clientId, String(text));
  syncNotesToServer(coachId, clientId, { coach_notes: String(text) });
}

export function getClientMarkedPaid(clientId) {
  if (!clientId) return false;
  try {
    return localStorage.getItem(PAID_PREFIX + clientId) === 'true';
  } catch (e) {
    return false;
  }
}

export function setClientMarkedPaid(clientId, value) {
  if (!clientId) return;
  try {
    localStorage.setItem(PAID_PREFIX + clientId, value ? 'true' : 'false');
  } catch (e) {}
}
