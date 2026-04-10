/**
 * Upload coach/client profile photo to public storage and persist profiles.avatar_url.
 * Bucket: profile_images (see supabase/migrations/20260408130000_profile_images_public_bucket.sql).
 */
import { compressImage } from '@/lib/messaging/messageMediaStorage';

const BUCKET = 'profile_images';

/**
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, userId: string, file: File }}
 * @returns {Promise<string>} Public URL stored on profiles.avatar_url
 */
export async function uploadAndSaveProfileAvatar({ supabase, userId, file }) {
  if (!supabase || !userId || !file) throw new Error('Missing upload parameters');

  const blob = await compressImage(file);
  const isGifOutput = blob instanceof File && String(blob.type || '').toLowerCase().includes('gif');
  const ext = isGifOutput ? 'gif' : 'jpg';
  const contentType = isGifOutput ? 'image/gif' : 'image/jpeg';
  const path = `${userId}/avatar.${ext}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType,
    upsert: true,
  });
  if (upErr) throw upErr;

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = pub?.publicUrl;
  if (!publicUrl) throw new Error('Could not resolve public URL for upload');

  const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);
  if (dbErr) throw dbErr;

  return publicUrl;
}
