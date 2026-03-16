/**
 * Result story image upload and helpers. Uses marketplace_coach_media bucket with path
 * {coachId}/result_stories/{storyId}/{before|after}.{ext} so existing RLS applies.
 */
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

const BUCKET = 'marketplace_coach_media';
const PREFIX = 'result_stories';

/**
 * Upload a before or after image for a result story.
 * @param {{ coachId: string, storyId: string, file: File, slot: 'before' | 'after' }}
 * @returns {Promise<string|null>} Storage path or null.
 */
export async function uploadResultStoryImage({ coachId, storyId, file, slot }) {
  if (!hasSupabase || !coachId || !storyId || !file || !slot) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const ext = (file.name || '').split('.').pop() || 'jpg';
  const path = `${coachId}/${PREFIX}/${storyId}/${slot}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: true });
  return error ? null : path;
}

/**
 * Create a signed URL for a result story image path (for preview in builder).
 * @param {string} path - Storage path from before_image_path or after_image_path.
 * @returns {Promise<string|null>}
 */
export async function getResultStoryImageUrl(path) {
  if (!hasSupabase || !path) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}
