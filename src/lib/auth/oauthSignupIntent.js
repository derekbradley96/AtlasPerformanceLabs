/**
 * OAuth signup intent + explicit-role detection.
 *
 * Email signups always set user_metadata.role (signUp options.data → handle_new_user trigger).
 * OAuth (Google/Apple) signups never do — the trigger silently defaults them to 'personal',
 * which loses would-be coaches and clients. Two mechanisms fix that:
 *
 * 1. Signup tab: the chosen role is stashed here before the OAuth redirect and applied
 *    in AuthCallback once the session exists (survives the external-browser round trip
 *    on native and the full-page redirect on web).
 * 2. Login tab / no intent: users whose metadata has no role ever chosen are routed to
 *    the role picker (/onboardingrole) instead of being assumed personal.
 */

const INTENT_KEY = 'atlas_oauth_signup_intent_v1';
const INTENT_TTL_MS = 30 * 60 * 1000;

/** @param {'coach'|'client'|'personal'} role */
export function setOAuthSignupIntent(role) {
  try {
    localStorage.setItem(INTENT_KEY, JSON.stringify({ role, ts: Date.now() }));
  } catch {}
}

/** Read AND clear the stashed intent. Returns null if absent/expired/invalid. */
export function consumeOAuthSignupIntent() {
  try {
    const raw = localStorage.getItem(INTENT_KEY);
    localStorage.removeItem(INTENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const role = String(parsed?.role || '').toLowerCase();
    if (!['coach', 'client', 'personal'].includes(role)) return null;
    if (Date.now() - Number(parsed?.ts || 0) > INTENT_TTL_MS) return null;
    return { role };
  } catch {
    return null;
  }
}

export function clearOAuthSignupIntent() {
  try {
    localStorage.removeItem(INTENT_KEY);
  } catch {}
}

/**
 * True when this auth user has ever explicitly chosen a role (email signup form,
 * OAuth signup intent, or the role picker). False = OAuth user defaulted by the
 * DB trigger who must be asked, never assumed.
 */
export function hasExplicitRoleChoice(supabaseUser) {
  const meta = supabaseUser?.user_metadata;
  if (!meta || typeof meta !== 'object') return false;
  const role = meta.role ?? meta.user_type ?? meta.account_type;
  return typeof role === 'string' && role.trim() !== '';
}
