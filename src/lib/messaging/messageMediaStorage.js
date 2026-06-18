/**
 * Supabase Storage for message media (voice notes, images, gifs).
 * Bucket: message_media (private). Path: {threadId}/{messageId}.ext
 */

const BUCKET = 'message_media';
const SIGNED_URL_EXPIRY_SEC = 60 * 60 * 24 * 7; // 7d for playback

/**
 * Get file extension from mime type (webm, m4a).
 * @param {string} mimeType
 * @returns {string}
 */
function getExtension(mimeType) {
  if (!mimeType || typeof mimeType !== 'string') return 'webm';
  const m = mimeType.toLowerCase();
  if (m.includes('mp4') || m.includes('m4a')) return 'm4a';
  return 'webm';
}

/**
 * Upload a voice blob to message_media/{threadId}/{messageId}.{ext}.
 * Returns the storage path (use createSignedUrl for playback).
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, threadId: string, messageId: string, blob: Blob, mimeType: string }}
 * @returns {Promise<string>} storage path
 */
export async function uploadVoiceBlob({ supabase, threadId, messageId, blob, mimeType }) {
  if (!supabase || !threadId || !messageId || !blob) throw new Error('uploadVoiceBlob: supabase, threadId, messageId, blob required');
  const ext = getExtension(mimeType);
  const path = `${threadId}/${messageId}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: mimeType || 'audio/webm',
    upsert: true,
  });
  if (error) throw error;
  return path;
}

function getImageExtension(fileName = '', mimeType = '') {
  const n = String(fileName || '').toLowerCase();
  if (n.endsWith('.png') || mimeType.includes('png')) return 'png';
  if (n.endsWith('.webp') || mimeType.includes('webp')) return 'webp';
  if (n.endsWith('.gif') || mimeType.includes('gif')) return 'gif';
  return 'jpg';
}

/**
 * Compress image for chat upload.
 * @param {File|Blob} file
 * @returns {Promise<Blob>}
 */
export async function compressImage(file) {
  if (!file || typeof window === 'undefined' || typeof document === 'undefined') return file;
  if (String(file.type || '').includes('gif')) return file; // keep GIF animation
  try {
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
    canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.8);
  });
  } catch (_) {
    return file;
  }
}

/**
 * Upload image/gif blob to message_media/{threadId}/{messageId}.{ext}.
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, threadId: string, messageId: string, blob: Blob, mimeType?: string, fileName?: string }}
 * @returns {Promise<string>}
 */
export async function uploadImageBlob({ supabase, threadId, messageId, blob, mimeType = 'image/jpeg', fileName = '' }) {
  if (!supabase || !threadId || !messageId || !blob) throw new Error('uploadImageBlob: required args missing');
  const ext = getImageExtension(fileName, mimeType);
  const path = `${threadId}/${messageId}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: mimeType || 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  return path;
}

export function getVideoExtension(fileName = '', mimeType = '') {
  const n = String(fileName || '').toLowerCase();
  if (n.endsWith('.mp4') || mimeType.includes('mp4')) return 'mp4';
  if (n.endsWith('.mov') || mimeType.includes('quicktime')) return 'mov';
  return 'webm';
}

export async function uploadVideoBlob({
  supabase, threadId, messageId, blob,
  mimeType = 'video/mp4', fileName = ''
}) {
  if (!supabase || !threadId || !messageId || !blob) {
    throw new Error('uploadVideoBlob: required args missing');
  }
  const ext = getVideoExtension(fileName, mimeType);
  const path = `${threadId}/${messageId}_video.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: mimeType || 'video/mp4',
    upsert: true,
  });
  if (error) throw error;
  return path;
}

/**
 * Create a signed URL for playback (private bucket).
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, path: string }}
 * @returns {Promise<string|null>}
 */
export async function createSignedUrl({ supabase, path }) {
  if (!supabase || !path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_EXPIRY_SEC);
  if (error) return null;
  return data?.signedUrl ?? null;
}
