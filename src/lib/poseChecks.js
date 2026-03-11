/**
 * Pose check helpers: submit (client), list/review (coach).
 * Uses public.pose_checks, public.pose_check_items, and storage bucket pose_check_photos.
 * Reuses getMyClientId, getWeekStartISO, getCoachClients from checkins where applicable.
 *
 * Compatibility: pose_checks.photos (JSONB) remains for backward compatibility. New flows should use
 * pose_check_items (one row per mandatory pose: photo_path, coach_rating, coach_notes) as the structured source of truth.
 * When a pose_check is created for a client with an active contest_prep with division_key, pose_check_items are created from pose_division_templates / pose_template_items.
 */

import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getWeekStartISO } from '@/lib/checkins';

const POSE_CHECK_PHOTOS_BUCKET = 'pose_check_photos';

/**
 * Returns existing pose_checks row for (client_id, week_start), or null.
 * @param {string} clientId
 * @param {string} weekStart - YYYY-MM-DD (Monday)
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function getPoseCheckForWeek(clientId, weekStart) {
  if (!hasSupabase || !clientId || !weekStart) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('pose_checks')
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
 * Create pose_check_items from division template (mandatory poses). Called after inserting a pose_check when client has active prep with division_key.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} poseCheckId
 * @param {string} divisionKey - pose_division_templates.division_key
 * @returns {Promise<boolean>} true if any items were created or template not found (no error)
 */
async function createPoseCheckItemsFromDivision(supabase, poseCheckId, divisionKey) {
  if (!poseCheckId || !divisionKey) return true;
  try {
    const { data: template, error: templateErr } = await supabase
      .from('pose_division_templates')
      .select('id')
      .eq('division_key', divisionKey)
      .maybeSingle();
    if (templateErr || !template?.id) return true;

    const { data: items, error: itemsErr } = await supabase
      .from('pose_template_items')
      .select('pose_key, pose_label, sort_order')
      .eq('template_id', template.id)
      .eq('is_mandatory', true)
      .order('sort_order', { ascending: true });
    if (itemsErr || !Array.isArray(items) || items.length === 0) return true;

    const rows = items.map((i) => ({
      pose_check_id: poseCheckId,
      pose_key: i.pose_key,
      pose_label: i.pose_label,
      sort_order: i.sort_order ?? 0,
    }));
    const { error: insertErr } = await supabase.from('pose_check_items').insert(rows);
    return !insertErr;
  } catch {
    return false;
  }
}

/**
 * Insert pose_checks row (client_id, week_start, client_notes, photos []). Returns inserted row or null.
 * When the client has an active contest_prep with division_key, also:
 * - sets pose_checks.prep_id to the active prep
 * - creates pose_check_items from pose_division_templates / pose_template_items for that division.
 * @param {{ client_id: string, week_start: string, client_notes?: string | null }}
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function insertPoseCheck({ client_id, week_start, client_notes = null }) {
  if (!hasSupabase || !client_id || !week_start) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('pose_checks')
      .insert({ client_id, week_start, client_notes, photos: [] })
      .select()
      .single();
    if (error) return null;

    const activePrep = await supabase
      .from('contest_preps')
      .select('id, division_key')
      .eq('client_id', client_id)
      .eq('is_active', true)
      .maybeSingle();

    const prep = activePrep.data;
    if (prep?.id) {
      await supabase.from('pose_checks').update({ prep_id: prep.id }).eq('id', data.id);
      if (prep.division_key) {
        await createPoseCheckItemsFromDivision(supabase, data.id, prep.division_key);
      }
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Upload one file to pose_check_photos/{client_id}/{pose_check_id}/{filename}.
 * @param {{ clientId: string, poseCheckId: string, file: File }}
 * @returns {Promise<string | null>} Storage path or null
 */
export async function uploadPoseCheckPhoto({ clientId, poseCheckId, file }) {
  if (!hasSupabase || !clientId || !poseCheckId || !file) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const ext = (file.name || '').split('.').pop() || 'jpg';
  const name = `${clientId}/${poseCheckId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from(POSE_CHECK_PHOTOS_BUCKET)
    .upload(name, file, { contentType: file.type || 'image/jpeg', upsert: true });
  return error ? null : name;
}

/**
 * Update pose_checks.photos with array of storage paths.
 * @param {string} poseCheckId
 * @param {string[]} photos
 * @returns {Promise<boolean>}
 */
export async function updatePoseCheckPhotos(poseCheckId, photos) {
  if (!hasSupabase || !poseCheckId || !Array.isArray(photos)) return false;
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from('pose_checks').update({ photos }).eq('id', poseCheckId);
  return !error;
}

/**
 * Fetch pose_checks for coach's clients and return latest per client (by submitted_at desc).
 * @param {string[]} clientIds
 * @returns {Promise<Array<Record<string, unknown>>>} Latest pose check per client (may have gaps)
 */
export async function getLatestPoseChecksForCoach(clientIds) {
  if (!hasSupabase || !Array.isArray(clientIds) || clientIds.length === 0) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('pose_checks')
      .select('*')
      .in('client_id', clientIds)
      .order('submitted_at', { ascending: false });
    if (error) return [];
    const rows = Array.isArray(data) ? data : [];
    const latestByClient = {};
    for (const row of rows) {
      if (!latestByClient[row.client_id]) latestByClient[row.client_id] = row;
    }
    return Object.values(latestByClient);
  } catch {
    return [];
  }
}

/**
 * Fetch single pose check by id (coach must own client via RLS).
 * @param {string} poseCheckId
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function getPoseCheckById(poseCheckId) {
  if (!hasSupabase || !poseCheckId) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('pose_checks')
      .select('*')
      .eq('id', poseCheckId)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Fetch pose_check_items for a pose check (ordered by sort_order). For structured per-pose review.
 * @param {string} poseCheckId
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function getPoseCheckItems(poseCheckId) {
  if (!hasSupabase || !poseCheckId) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('pose_check_items')
      .select('*')
      .eq('pose_check_id', poseCheckId)
      .order('sort_order', { ascending: true });
    if (error) return [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Update a single pose_check_item (coach_rating, coach_notes).
 * @param {string} itemId - pose_check_items.id
 * @param {{ coach_rating?: number | null, coach_notes?: string | null }}
 * @returns {Promise<boolean>}
 */
export async function updatePoseCheckItem(itemId, { coach_rating = null, coach_notes = null }) {
  if (!hasSupabase || !itemId) return false;
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    const payload = {};
    if (coach_rating !== undefined) payload.coach_rating = coach_rating;
    if (coach_notes !== undefined) payload.coach_notes = coach_notes;
    if (Object.keys(payload).length === 0) return true;
    const { error } = await supabase.from('pose_check_items').update(payload).eq('id', itemId);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Save review: set coach_rating, coach_notes, reviewed_at, reviewed_by on pose_checks.
 * @param {string} poseCheckId
 * @param {{ coach_rating?: number | null, coach_notes?: string | null }}
 * @returns {Promise<boolean>}
 */
export async function savePoseCheckReview(poseCheckId, { coach_rating = null, coach_notes = null }) {
  if (!hasSupabase || !poseCheckId) return false;
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return false;
    const payload = {
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      ...(coach_rating != null && { coach_rating }),
      ...(coach_notes != null && { coach_notes }),
    };
    const { error } = await supabase.from('pose_checks').update(payload).eq('id', poseCheckId);
    return !error;
  } catch {
    return false;
  }
}

const SIGNED_URL_EXPIRY_SEC = 60 * 60;

/**
 * Create signed URL for pose_check_photos path (for coach review).
 * @param {string} path - e.g. client_id/pose_check_id/filename.jpg
 * @returns {Promise<string | null>}
 */
export async function createPoseCheckPhotoSignedUrl(path) {
  if (!hasSupabase || !path) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.storage
      .from(POSE_CHECK_PHOTOS_BUCKET)
      .createSignedUrl(path, SIGNED_URL_EXPIRY_SEC);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * Allowed tag values for pose_conditioning_notes (must match DB CHECK).
 */
export const POSE_CONDITIONING_TAGS = [
  { value: 'conditioning_improved', label: 'Conditioning improved' },
  { value: 'fullness_drop', label: 'Fullness drop' },
  { value: 'glutes_not_in', label: 'Glutes not in' },
  { value: 'hamstring_detail', label: 'Hamstring detail' },
  { value: 'back_density', label: 'Back density' },
];

/**
 * List conditioning notes for given pose_check_item ids (current coach only).
 * @param {string[]} poseCheckItemIds
 * @returns {Promise<Array<{ id: string, pose_check_item_id: string, coach_id: string, tag: string, note: string | null, created_at: string }>>}
 */
export async function listPoseConditioningNotes(poseCheckItemIds) {
  if (!hasSupabase || !poseCheckItemIds?.length) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('pose_conditioning_notes')
      .select('id, pose_check_item_id, coach_id, tag, note, created_at')
      .in('pose_check_item_id', poseCheckItemIds)
      .order('created_at', { ascending: true });
    if (error) return [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Add a conditioning note (tag + optional note) for a pose_check_item. Uses current user as coach_id.
 * @param {string} poseCheckItemId
 * @param {string} tag - one of POSE_CONDITIONING_TAGS[].value
 * @param {string} [note]
 * @returns {Promise<{ id: string } | null>}
 */
export async function addPoseConditioningNote(poseCheckItemId, tag, note = '') {
  if (!hasSupabase || !poseCheckItemId || !tag) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return null;
    const { data, error } = await supabase
      .from('pose_conditioning_notes')
      .insert({
        pose_check_item_id: poseCheckItemId,
        coach_id: user.id,
        tag,
        note: note?.trim() || null,
      })
      .select('id')
      .single();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Delete a conditioning note by id.
 * @param {string} noteId
 * @returns {Promise<boolean>}
 */
export async function removePoseConditioningNote(noteId) {
  if (!hasSupabase || !noteId) return false;
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('pose_conditioning_notes').delete().eq('id', noteId);
    return !error;
  } catch {
    return false;
  }
}

export { getWeekStartISO } from '@/lib/checkins';
