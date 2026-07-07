/**
 * Minimal frontend helpers for the Check-In Engine (public.checkins).
 * Uses the existing Supabase client from @/lib/supabaseClient only.
 */

import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { isCoach, isClient } from '@/lib/roles';
import { resolveCoachLinkId } from '@/lib/coachLink';

/**
 * Returns YYYY-MM-DD for Monday of the week containing the given date (local time, stable).
 * @param {Date | string | number} [date] - Defaults to today.
 * @returns {string} ISO date string (YYYY-MM-DD).
 */
export function getWeekStartISO(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return getWeekStartISO(new Date());
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const dayNum = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayNum}`;
}

/**
 * Fetches the current user's client record id (when logged in as client).
 * Uses public.clients.user_id = auth.uid() (from checkins_engine migration).
 * @returns {Promise<string | null>} Client id or null if not a linked client / not signed in.
 */
export async function getMyClientId() {
  if (!hasSupabase) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return null;
    const { data, error } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error || !data) return null;
    return data.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetches clients owned by the current coach (trainer_id = auth.uid()).
 * @returns {Promise<Array<{ id: string; name?: string; [key: string]: unknown }>>}
 */
export async function getCoachClients() {
  if (!hasSupabase) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return [];
    const baseSelectFull = 'id, name, full_name, created_at, user_id, show_date, client_type';
    const baseSelectLegacy = 'id, name, full_name, created_at, user_id';

    const load = async (selectCols) => {
      let result = await supabase
        .from('clients')
        .select(selectCols)
        .or(`trainer_id.eq.${user.id},coach_id.eq.${user.id}`)
        .order('created_at', { ascending: false });
      if (!result.error) return result;

      result = await supabase
        .from('clients')
        .select(selectCols)
        .eq('trainer_id', user.id)
        .order('created_at', { ascending: false });
      if (!result.error) return result;

      return supabase
        .from('clients')
        .select(selectCols)
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false });
    };

    let result = await load(baseSelectFull);
    const msg = String(result.error?.message || '');
    if (result.error && /show_date|client_type|schema cache|PGRST204/i.test(msg)) {
      result = await load(baseSelectLegacy);
    }
    if (!result.error) return Array.isArray(result.data) ? result.data : [];

    return [];
  } catch {
    return [];
  }
}

/**
 * Returns the coach (trainer) profile id for a client.
 * @param {string} clientId - public.clients.id
 * @returns {Promise<string | null>} Coach profile id (trainer_id or coach_id) or null.
 */
export async function getClientCoachId(clientId) {
  if (!hasSupabase || !clientId) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('trainer_id, coach_id')
      .eq('id', clientId)
      .maybeSingle();
    if (error || !data) return null;
    return resolveCoachLinkId(data);
  } catch {
    return null;
  }
}

/**
 * Returns the existing checkin for the given client and week start, or null.
 * weekStart must be YYYY-MM-DD (Monday).
 * @param {string} clientId - public.clients.id
 * @param {string} weekStart - YYYY-MM-DD
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function getCheckinForWeek(clientId, weekStart) {
  if (!hasSupabase || !clientId || !weekStart) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('checkins')
      .select('*')
      .eq('client_id', clientId)
      .eq('week_start', weekStart)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

// NOTE: a legacy submitCheckin() helper was removed here — it omitted the
// NOT NULL trainer_id column so its insert always failed (and it swallowed
// the error). The live submit path is ClientCheckIn.jsx's mutation.

const FOCUS_VALUES = ['transformation', 'competition', 'integrated'];

/**
 * Resolves focus_type for the current user (for check-in form).
 * Client: coach's coach_focus from profiles; Personal: 'transformation'; Coach: profile coach_focus.
 * @returns {Promise<'transformation'|'competition'|'integrated'>}
 */
export async function getFocusTypeForCurrentUser() {
  if (!hasSupabase) return 'transformation';
  const supabase = getSupabase();
  if (!supabase) return 'transformation';
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return 'transformation';
    const { data: profile } = await supabase.from('profiles').select('role, coach_focus').eq('id', user.id).maybeSingle();
    const role = (profile?.role ?? '').toString().trim().toLowerCase();
    if (isCoach(role)) {
      const focus = (profile?.coach_focus ?? '').toString().trim().toLowerCase();
      return FOCUS_VALUES.includes(focus) ? focus : 'transformation';
    }
    if (isClient(role)) {
      const { data: clientRow } = await supabase.from('clients').select('coach_id, trainer_id').eq('user_id', user.id).maybeSingle();
      const linkedCoachId = resolveCoachLinkId(clientRow);
      if (linkedCoachId) {
        const { data: coachProfile } = await supabase.from('profiles').select('coach_focus').eq('id', linkedCoachId).maybeSingle();
        const focus = (coachProfile?.coach_focus ?? '').toString().trim().toLowerCase();
        return FOCUS_VALUES.includes(focus) ? focus : 'transformation';
      }
    }
    return 'transformation';
  } catch {
    return 'transformation';
  }
}

const CHECKIN_PHOTOS_BUCKET = 'checkin_photos';

/**
 * Upload a photo file to checkin_photos/{client_id}/{checkin_id}/{filename}.
 * @param {{ clientId: string, checkinId: string, file: File }}
 * @returns {Promise<string|null>} Storage path or null.
 */
export async function uploadCheckinPhoto({ clientId, checkinId, file }) {
  if (!hasSupabase || !clientId || !checkinId || !file) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const ext = (file.name || '').split('.').pop() || 'jpg';
  const name = `${clientId}/${checkinId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(CHECKIN_PHOTOS_BUCKET).upload(name, file, { contentType: file.type || 'image/jpeg', upsert: true });
  return error ? null : name;
}

/**
 * Update checkin row with photos array (paths).
 * @param {string} checkinId
 * @param {string[]} photos
 * @returns {Promise<boolean>}
 */
export async function updateCheckinPhotos(checkinId, photos) {
  if (!hasSupabase || !checkinId || !Array.isArray(photos)) return false;
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from('checkins').update({ photos }).eq('id', checkinId);
  return !error;
}

/**
 * Fetch latest checkin per client from v_client_latest_checkin for coach's clients.
 * @param {string[]} clientIds
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function getLatestCheckinsForCoach(clientIds) {
  if (!hasSupabase || !Array.isArray(clientIds) || clientIds.length === 0) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_client_latest_checkin')
      .select('*')
      .in('client_id', clientIds);
    if (error) return [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Fetch a single checkin by id (coach must own the client).
 * @param {string} checkinId
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function getCheckinById(checkinId) {
  if (!hasSupabase || !checkinId) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('checkins').select('*').eq('id', checkinId).maybeSingle();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Set reviewed_at and reviewed_by on a checkin (coach only, RLS).
 * @param {string} checkinId
 * @param {{ coach_review_tags?: string[] }} [opts]
 * @returns {Promise<boolean>}
 */
export async function markCheckinReviewed(checkinId, opts = {}) {
  if (!hasSupabase || !checkinId) return false;
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return false;
    const patch = { reviewed_at: new Date().toISOString(), reviewed_by: user.id };
    if (Array.isArray(opts.coach_review_tags) && opts.coach_review_tags.length > 0) {
      patch.coach_review_tags = [...new Set(opts.coach_review_tags.map((t) => String(t).trim()).filter(Boolean))];
    }
    const { error } = await supabase.from('checkins').update(patch).eq('id', checkinId);
    return !error;
  } catch {
    return false;
  }
}

const CHECKIN_PHOTO_SIGNED_EXPIRY_SEC = 60 * 60;

/**
 * Upload a photo for peak week check-in (store in checkin_photos/peak_week/...).
 * @param {{ clientId: string, file: File }}
 * @returns {Promise<string|null>} Storage path or null.
 */
export async function uploadPeakWeekCheckinPhoto({ clientId, file }) {
  if (!hasSupabase || !clientId || !file) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const ext = (file.name || '').split('.').pop() || 'jpg';
  const name = `peak_week/${clientId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(CHECKIN_PHOTOS_BUCKET).upload(name, file, { contentType: file.type || 'image/jpeg', upsert: true });
  return error ? null : name;
}

/**
 * Create a signed URL for a checkin_photos storage path (private bucket).
 * @param {string} path - Storage path (e.g. client_id/checkin_id/filename.jpg)
 * @returns {Promise<string|null>}
 */
export async function createCheckinPhotoSignedUrl(path) {
  if (!hasSupabase || !path) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.storage
      .from(CHECKIN_PHOTOS_BUCKET)
      .createSignedUrl(path, CHECKIN_PHOTO_SIGNED_EXPIRY_SEC);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}
