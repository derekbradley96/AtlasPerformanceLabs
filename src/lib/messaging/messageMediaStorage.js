/**
 * Supabase Storage for message media (voice notes, etc.).
 * Bucket: message_media (private). Path: {threadId}/{messageId}.webm or .m4a
 */

const BUCKET = 'message_media';
const SIGNED_URL_EXPIRY_SEC = 60 * 60 * 24; // 24h for playback

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
