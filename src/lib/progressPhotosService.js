/**
 * Progress photos: Supabase table `progress_photos` + private bucket `progress_photos`.
 * Shared engine for client self-serve, coach roster view, and prep comparison.
 */

import { getClientCoachId } from '@/lib/checkins';

const BUCKET = 'progress_photos';
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 7; // 7 days

const ALLOWED_TAGS = new Set(['front', 'back', 'side_left', 'side_right', 'custom']);

/**
 * Compress image (canvas, max 1600px, jpeg quality 0.82) — same pattern as messageMediaStorage.compressImage.
 * @param {File|Blob} file
 * @returns {Promise<Blob>}
 */
export async function compressProgressPhoto(file) {
  try {
    if (!file || typeof window === 'undefined' || typeof document === 'undefined') return file;
    if (String(file.type || '').includes('gif')) return file;
    const bitmap = await createImageBitmap(file);
    const maxWidth = 1600;
    const scale = bitmap.width > maxWidth ? maxWidth / bitmap.width : 1;
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, w, h);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.82);
    });
  } catch (error) {
    console.error('[progressPhotosService] compressProgressPhoto:', error);
    return null;
  }
}

/**
 * @param {{
 *   supabase: import('@supabase/supabase-js').SupabaseClient,
 *   clientId: string,
 *   profileId?: string | null,
 *   coachId?: string | null,
 *   file: File,
 *   dateTaken: string,
 *   tag: string,
 *   notes?: string | null,
 *   weightKg?: number | null
 * }} args
 */
export async function uploadProgressPhoto({
  supabase,
  clientId,
  profileId,
  coachId,
  file,
  dateTaken,
  tag,
  notes,
  weightKg,
}) {
  try {
    if (!supabase || !file) throw new Error('uploadProgressPhoto: supabase and file are required');
    const isPersonalUpload = !clientId && profileId;
    if (!clientId && !profileId) {
      throw new Error('uploadProgressPhoto: clientId or profileId is required');
    }
    const safeTag = ALLOWED_TAGS.has(String(tag)) ? String(tag) : 'front';
    const blob = await compressProgressPhoto(file);
    if (!blob) throw new Error('Could not process image');
    const photoId = crypto.randomUUID();
    const path = isPersonalUpload
      ? `personal/${profileId}/${photoId}.jpg`
      : `${clientId}/${photoId}.jpg`;

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    if (upErr) throw upErr;

    let resolvedProfileId = profileId ?? null;
    let resolvedCoachId = coachId ?? null;
    if (!isPersonalUpload) {
      resolvedCoachId = coachId ?? (await getClientCoachId(clientId));
      if (!resolvedProfileId) {
        const { data: crow } = await supabase.from('clients').select('user_id').eq('id', clientId).maybeSingle();
        if (crow?.user_id) resolvedProfileId = crow.user_id;
      }
    }

    const row = {
      client_id: clientId || null,
      profile_id: resolvedProfileId,
      coach_id: resolvedCoachId,
      storage_path: path,
      date_taken: dateTaken || new Date().toISOString().slice(0, 10),
      tag: safeTag,
      notes: notes != null && String(notes).trim() !== '' ? String(notes).trim() : null,
      weight_kg: weightKg != null && Number.isFinite(Number(weightKg)) ? Number(weightKg) : null,
      is_deleted: false,
    };

    const { data: inserted, error: insErr } = await supabase.from('progress_photos').insert(row).select('*').single();
    if (insErr) throw insErr;

    const signedUrl = await createProgressPhotoSignedUrl({ supabase, path: inserted.storage_path });
    return { ...inserted, signed_url: signedUrl, photo_url: signedUrl };
  } catch (error) {
    console.error('[progressPhotosService] uploadProgressPhoto:', error);
    throw error;
  }
}

export async function createProgressPhotoSignedUrl({ supabase, path }) {
  try {
    if (!supabase || !path) return null;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_EXPIRY);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch (error) {
    console.error('[progressPhotosService] createProgressPhotoSignedUrl:', error);
    return null;
  }
}

/**
 * @param {{
 *   supabase: import('@supabase/supabase-js').SupabaseClient,
 *   clientId?: string | null,
 *   profileId?: string | null
 * }} args
 */
export async function listProgressPhotos({ supabase, clientId, profileId }) {
  try {
    if (!supabase) return [];
    let q = supabase
      .from('progress_photos')
      .select('*')
      .eq('is_deleted', false)
      .order('date_taken', { ascending: false });

    if (clientId) {
      q = q.eq('client_id', clientId);
    } else if (profileId) {
      q = q.eq('profile_id', profileId);
    } else {
      return [];
    }

    const { data, error } = await q;
    if (error || !Array.isArray(data)) return [];

    const out = [];
    for (const row of data) {
      const signedUrl = await createProgressPhotoSignedUrl({ supabase, path: row.storage_path });
      out.push({
        ...row,
        signed_url: signedUrl,
        photo_url: signedUrl,
      });
    }
    return out;
  } catch (error) {
    console.error('[progressPhotosService] listProgressPhotos:', error);
    return [];
  }
}

/**
 * Coach soft-delete (RLS). Clients may not have UPDATE policy — coach-only.
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, photoId: string }} args
 */
export async function softDeletePhoto({ supabase, photoId }) {
  try {
    if (!supabase || !photoId) return false;
    const { error } = await supabase.from('progress_photos').update({ is_deleted: true }).eq('id', photoId);
    return !error;
  } catch (error) {
    console.error('[progressPhotosService] softDeletePhoto:', error);
    return false;
  }
}
