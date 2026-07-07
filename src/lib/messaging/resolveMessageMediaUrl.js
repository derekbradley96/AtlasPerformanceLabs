/**
 * Chat media URLs are stored at send time as either a 7-day signed URL or a
 * 'path:{storagePath}' fallback (when signing failed). Signed URLs expire, so
 * anything older than a week renders broken if used raw. This resolver
 * extracts the storage path from either form and mints a fresh signed URL
 * when the stored one is missing, expired, or close to expiry.
 *
 * External URLs (GIPHY previews, blob:/data: optimistic sends) pass through.
 */

import { getSupabase } from '@/lib/supabaseClient';

const BUCKET = 'message_media';
const SIGNED_URL_EXPIRY_SEC = 60 * 60 * 24 * 7;
/** Re-sign when the stored token has less than a day left. */
const MIN_REMAINING_MS = 24 * 60 * 60 * 1000;

/** path -> { url, ts } for this session (avoid re-signing per re-render). */
const freshUrlCache = new Map();

/** Storage path from 'path:...' or a Supabase signed/public URL for the bucket. Null = not ours. */
export function extractMessageMediaPath(mediaUrl) {
  const s = String(mediaUrl || '');
  if (!s) return null;
  if (s.startsWith('path:')) return s.slice(5);
  const m = s.match(/\/object\/(?:sign|public|authenticated)\/message_media\/([^?]+)/);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }
  return null;
}

/** Expiry epoch-ms of a signed URL's JWT token, or null if unreadable. */
export function getSignedUrlExpiryMs(mediaUrl) {
  try {
    const token = new URL(String(mediaUrl)).searchParams.get('token');
    if (!token) return null;
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

function storedUrlStillGood(mediaUrl) {
  if (!mediaUrl || String(mediaUrl).startsWith('path:')) return false;
  const exp = getSignedUrlExpiryMs(mediaUrl);
  if (exp == null) return false;
  return exp - Date.now() > MIN_REMAINING_MS;
}

/**
 * Best displayable URL right now, without any network call:
 * stored URL when it's external or still valid, cached fresh URL, else null.
 */
export function getDisplayableMediaUrl(mediaUrl) {
  const path = extractMessageMediaPath(mediaUrl);
  if (!path) return mediaUrl || null;
  const cached = freshUrlCache.get(path);
  if (cached && Date.now() - cached.ts < (SIGNED_URL_EXPIRY_SEC * 1000 - MIN_REMAINING_MS)) return cached.url;
  if (storedUrlStillGood(mediaUrl)) return mediaUrl;
  return null;
}

/**
 * Resolve to a working URL, re-signing when needed.
 * @param {string} mediaUrl - stored media_url
 * @param {{ force?: boolean }} [opts] - force a fresh signature (e.g. after an onError)
 * @returns {Promise<string|null>}
 */
export async function resolveMessageMediaUrl(mediaUrl, opts = {}) {
  const path = extractMessageMediaPath(mediaUrl);
  if (!path) return mediaUrl || null;

  if (!opts.force) {
    const displayable = getDisplayableMediaUrl(mediaUrl);
    if (displayable) return displayable;
  }

  const supabase = getSupabase();
  if (!supabase) return storedUrlStillGood(mediaUrl) ? mediaUrl : null;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_EXPIRY_SEC);
  const fresh = !error && data?.signedUrl ? data.signedUrl : null;
  if (fresh) {
    freshUrlCache.set(path, { url: fresh, ts: Date.now() });
    return fresh;
  }
  return storedUrlStillGood(mediaUrl) ? mediaUrl : null;
}
