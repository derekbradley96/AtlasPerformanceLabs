/**
 * Referral helpers for coaches: link generation, clipboard copy, and event tracking.
 * Uses profiles.referral_code, coach_referral_events, and getAppOrigin().
 */
import { getAppOrigin } from '@/lib/appOrigin';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getInviteCode, getOrCreateInviteCode } from '@/lib/inviteCodeStore';

/**
 * Build the shareable referral link (auth signup with ref param).
 * @param { { referral_code?: string, referralCode?: string } } coach - Coach object with referral_code or referralCode
 * @returns {string} Full URL or empty string if no code
 */
export function getCoachReferralLink(coach) {
  const code = (coach?.referral_code ?? coach?.referralCode ?? '').toString().trim();
  if (!code) return '';
  const origin = getAppOrigin();
  return `${origin.replace(/\/$/, '')}/auth?ref=${encodeURIComponent(code)}`;
}

/**
 * Single link coaches share with clients: opens client signup with invite attached (AuthScreen reads `invite`).
 * Same code as invite / referral_code on the coach profile.
 * @param {string|null|undefined} inviteCode - e.g. atlas-3034
 * @returns {string} Full URL or empty if no code
 */
export function getCoachClientSignupLink(inviteCode) {
  const code = (inviteCode ?? '').toString().trim();
  if (!code) return '';
  const origin = getAppOrigin().replace(/\/$/, '');
  return `${origin}/auth?mode=signup&account=client&invite=${encodeURIComponent(code)}`;
}

/**
 * Stable join URL when referral_code is not in UI state yet; resolves to a code on open (see JoinByCodePage).
 * @param {string|null|undefined} coachUserId - profiles.id (UUID) or demo trainer id
 * @returns {string}
 */
export function getCoachJoinLinkByCoachId(coachUserId) {
  const id = (coachUserId ?? '').toString().trim();
  if (!id) return '';
  const origin = getAppOrigin().replace(/\/$/, '');
  return `${origin}/join?coach=${encodeURIComponent(id)}`;
}

/**
 * Prefer direct auth invite URL when code is known; otherwise `/join?coach=` (live) or local demo invite link.
 * @param {string|null|undefined} inviteCode
 * @param {string|null|undefined} coachUserId
 * @returns {string}
 */
export function getCoachClientJoinLinkPrimary(inviteCode, coachUserId) {
  const code = (inviteCode ?? '').toString().trim();
  if (code) return getCoachClientSignupLink(code);
  const id = (coachUserId ?? '').toString().trim();
  if (!id) return '';
  if (!hasSupabase) {
    const localCode = getInviteCode(id) || getOrCreateInviteCode(id);
    return getCoachClientSignupLink(localCode);
  }
  return getCoachJoinLinkByCoachId(id);
}

/**
 * Build the public coach profile URL (for /coach/:slug).
 * @param { { referral_code?: string, referralCode?: string } } coach - Coach object with referral_code or referralCode
 * @returns {string} Full URL or empty string if no code
 */
export function getCoachPublicProfileLink(coach) {
  const code = (coach?.referral_code ?? coach?.referralCode ?? '').toString().trim();
  if (!code) return '';
  const origin = getAppOrigin();
  return `${origin.replace(/\/$/, '')}/coach/${encodeURIComponent(code)}`;
}

/**
 * Copy a referral link to the clipboard.
 * @param {string} [link] - Link to copy; if omitted, returns false
 * @returns {Promise<boolean>} True if copy succeeded
 */
export async function copyReferralLinkToClipboard(link) {
  if (!link || typeof link !== 'string') return false;
  try {
    await navigator.clipboard.writeText(link);
    return true;
  } catch {
    return false;
  }
}

const VALID_EVENT_TYPES = [
  'link_opened',
  'profile_viewed',
  'enquiry_started',
  'enquiry_submitted',
  'signup_completed',
  'public_profile_viewed',
  'result_story_viewed',
  'referral_link_copied',
  'referral_link_shared',
];

/**
 * Record a referral event (link opened, profile viewed, enquiry started, signup completed).
 * Call from app when the coach shares a link or when tracking is needed; for anonymous
 * events (e.g. visitor viewed profile), use an Edge Function that looks up coach_id by code.
 * @param {string} code - Referral code
 * @param {string} eventType - One of: link_opened, profile_viewed, enquiry_started, enquiry_submitted, signup_completed, public_profile_viewed, result_story_viewed, referral_link_copied, referral_link_shared
 * @param {Record<string, unknown>} [metadata] - Optional metadata
 * @param {string} [coachId] - Coach id (required for client-side insert; RLS requires coach_id = auth.uid())
 * @returns {Promise<boolean>} True if insert succeeded
 */
export async function trackReferralEvent(code, eventType, metadata = {}, coachId = null) {
  const normalized = (eventType || '').toString().trim().toLowerCase();
  if (!VALID_EVENT_TYPES.includes(normalized)) return false;
  if (!hasSupabase) return false;
  const supabase = getSupabase();
  if (!supabase) return false;
  const uid = coachId ?? (await supabase.auth.getUser()).data?.user?.id;
  if (!uid) return false;
  const codeStr = (code ?? '').toString().trim();
  if (!codeStr) return false;
  try {
    const { error } = await supabase.from('coach_referral_events').insert({
      coach_id: uid,
      code: codeStr,
      event_type: normalized,
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
    });
    return !error;
  } catch {
    return false;
  }
}
