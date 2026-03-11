/**
 * Stripe Connect state. In production, stripe_account_id and stripe_connected
 * come from backend (trainers table). For demo, persist in localStorage.
 */
const KEY_CONNECTED = 'atlas_stripe_connected';
const KEY_ACCOUNT_ID = 'atlas_stripe_account_id';

function safeGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ?? fallback;
  } catch (e) {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch (e) {}
}

export function isStripeConnected() {
  return safeGet(KEY_CONNECTED, '') === 'true';
}

export function getStripeAccountId() {
  return safeGet(KEY_ACCOUNT_ID, null);
}

export function setStripeConnected(connected, accountId = null) {
  safeSet(KEY_CONNECTED, connected ? 'true' : 'false');
  if (accountId != null) safeSet(KEY_ACCOUNT_ID, accountId);
}

/**
 * Start Connect flow: in production call backend GET /api/stripe/connect/create-account-link
 * and redirect to the returned url. For demo, toggle connected after "simulated" redirect.
 */
export function getConnectAccountLinkUrl() {
  const base = typeof import.meta !== 'undefined' && (import.meta.env?.VITE_STRIPE_CONNECT_API ?? '');
  if (base) return `${base.replace(/\/$/, '')}/stripe/connect/create-account-link`;
  return null;
}
