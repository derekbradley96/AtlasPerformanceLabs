/**
 * Minimal frontend helpers for the Check-In Engine (public.checkins).
 * Uses the existing Supabase client from @/lib/supabaseClient only.
 */

import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

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
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, full_name, created_at, user_id')
      .eq('trainer_id', user.id)
      .order('created_at', { ascending: false });
    if (error) return [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
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

/**
 * Inserts a checkin row. RLS allows insert when client owns the row or coach owns the client.
 * Payload must include client_id, week_start, focus_type; other fields optional.
 * @param {Record<string, unknown>} payload - At least client_id, week_start, focus_type; plus any metric/reflection/photo fields.
 * @returns {Promise<Record<string, unknown> | null>} Inserted row or null on failure.
 */
export async function submitCheckin(payload) {
  if (!hasSupabase || !payload || typeof payload !== 'object') return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const { client_id, week_start, focus_type } = payload;
  if (!client_id || !week_start || !focus_type) return null;
  try {
    const row = {
      client_id,
      week_start,
      focus_type: ['transformation', 'competition', 'integrated'].includes(String(focus_type)) ? focus_type : 'transformation',
      weight: payload.weight ?? null,
      steps_avg: payload.steps_avg ?? null,
      sleep_score: payload.sleep_score ?? null,
      energy_level: payload.energy_level ?? null,
      training_completion: payload.training_completion ?? null,
      nutrition_adherence: payload.nutrition_adherence ?? null,
      cardio_completion: payload.cardio_completion ?? null,
      posing_minutes: payload.posing_minutes ?? null,
      pump_quality: payload.pump_quality ?? null,
      digestion_score: payload.digestion_score ?? null,
      condition_notes: payload.condition_notes ?? null,
      wins: payload.wins ?? null,
      struggles: payload.struggles ?? null,
      questions: payload.questions ?? null,
      photos: Array.isArray(payload.photos) ? payload.photos : [],
    };
    const { data, error } = await supabase.from('checkins').insert(row).select().single();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

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
    if (role === 'coach' || role === 'trainer') {
      const focus = (profile?.coach_focus ?? '').toString().trim().toLowerCase();
      return FOCUS_VALUES.includes(focus) ? focus : 'transformation';
    }
    if (role === 'client') {
      const { data: clientRow } = await supabase.from('clients').select('trainer_id').eq('user_id', user.id).maybeSingle();
      if (clientRow?.trainer_id) {
        const { data: coachProfile } = await supabase.from('profiles').select('coach_focus').eq('id', clientRow.trainer_id).maybeSingle();
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
 * @returns {Promise<boolean>}
 */
export async function markCheckinReviewed(checkinId) {
  if (!hasSupabase || !checkinId) return false;
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return false;
    const { error } = await supabase
      .from('checkins')
      .update({ reviewed_at: new Date().toISOString(), reviewed_by: user.id })
      .eq('id', checkinId);
    return !error;
  } catch {
    return false;
  }
}

const CHECKIN_PHOTO_SIGNED_EXPIRY_SEC = 60 * 60;

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
