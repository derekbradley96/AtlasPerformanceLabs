/**
 * Upload coach/client profile photo to public storage and persist profiles.avatar_url.
 * Bucket: profile_images (see supabase/migrations/20260408130000_profile_images_public_bucket.sql).
 */
import { compressImage } from '@/lib/messaging/messageMediaStorage';

const BUCKET = 'profile_images';

function throwStorageUploadError(upErr) {
  if (!upErr) return;
  const um = String(upErr.message || '').toLowerCase();
  if (um.includes('bucket') || um.includes('not found') || upErr.statusCode === 404) {
    const wrap = new Error(
      'profile_images_bucket: Run npm run db:push in the repo so the profile_images storage bucket exists, then retry.'
    );
    wrap.cause = upErr;
    throw wrap;
  }
  throw upErr;
}

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
  if (upErr) throwStorageUploadError(upErr);

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = pub?.publicUrl;
  if (!publicUrl) throw new Error('Could not resolve public URL for upload');

  const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);
  if (dbErr) throw dbErr;

  return publicUrl;
}

/**
 * Upload Elite coach brand logo to profile_images (same bucket as avatars).
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, userId: string, file: File }}
 * @returns {Promise<string>} Public URL stored on profiles.brand_logo_url
 */
export async function uploadAndSaveCoachBrandLogo({ supabase, userId, file }) {
  if (!supabase || !userId || !file) throw new Error('Missing upload parameters');

  const blob = await compressImage(file);
  const isGifOutput = blob instanceof File && String(blob.type || '').toLowerCase().includes('gif');
  const ext = isGifOutput ? 'gif' : 'jpg';
  const contentType = isGifOutput ? 'image/gif' : 'image/jpeg';
  const path = `${userId}/brand-logo.${ext}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType,
    upsert: true,
  });
  if (upErr) throwStorageUploadError(upErr);

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = pub?.publicUrl;
  if (!publicUrl) throw new Error('Could not resolve public URL for upload');

  const { error: dbErr } = await supabase.from('profiles').update({ brand_logo_url: publicUrl }).eq('id', userId);
  if (dbErr) throw dbErr;

  return publicUrl;
}
