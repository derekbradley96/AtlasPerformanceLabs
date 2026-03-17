/**
 * Supabase Edge Functions API for Stripe (Connect, Services, Checkout).
 * Reads VITE_SUPABASE_URL from import.meta.env; errors cleanly when missing.
 * Sends JWT in Authorization header when Supabase Auth session exists.
 */

import { getSupabase } from '@/lib/supabaseClient';

const SUPABASE_URL_ERROR = 'Supabase URL not configured. Set VITE_SUPABASE_URL in .env.local.';

function getSupabaseUrl() {
  const url = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL;
  if (!url || typeof url !== 'string' || url.trim() === '') return null;
  return url.replace(/\/$/, '');
}

const getFunctionsUrl = () => {
  const base = getSupabaseUrl();
  if (!base) return null;
  return `${base}/functions/v1`;
};

/** Normalize invite/coach code for validation: trim + lowercase so case never matters. */
export function normalizeInviteCode(raw) {
  const s = typeof raw === 'string' ? raw : '';
  return s.trim().toLowerCase();
}

// Dev-only: log Supabase wiring once on boot
if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
  const raw = import.meta.env?.VITE_SUPABASE_URL;
  const base = getSupabaseUrl();
  const functionsBase = getFunctionsUrl();
  console.log('[Supabase] VITE_SUPABASE_URL:', raw ?? '(not set)');
  console.log('[Supabase] functions base URL:', functionsBase ?? '(not set; expected https://<project>.supabase.co/functions/v1)');
}

/**
 * Call an Edge Function via POST with JSON body. Sends JWT when Supabase session exists.
 * @param {string} name - Function name (e.g. 'stripe-connect-link')
 * @param {Record<string, unknown>} body
 * @returns {Promise<{ data?: unknown; error?: string }>}
 */
export async function invokeSupabaseFunction(name, body = {}) {
  const base = getFunctionsUrl();
  if (!base) return { error: SUPABASE_URL_ERROR, data: null };
  const headers = { 'Content-Type': 'application/json' };
  try {
    const supabase = getSupabase?.() ?? null;
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  } catch (_) {}
  try {
    const res = await fetch(`${base}/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data?.error ?? res.statusText, data: null };
    return { data, error: null };
  } catch (e) {
    return { error: e?.message ?? 'Network error', data: null };
  }
}

/**
 * Get Stripe Connect onboarding link. Returns { url } or error.
 * @param {string} userId
 * @returns {Promise<{ url?: string; error?: string }>}
 */
export async function stripeConnectLink(userId) {
  if (!userId) return { error: 'user_id required' };
  const { data, error } = await invokeSupabaseFunction('stripe-connect-link', { user_id: userId });
  if (error) return { error };
  return { url: data?.url ?? null };
}

/**
 * Get coach record (Stripe status, etc.).
 * @param {string} userId
 * @returns {Promise<{ coach?: { id: string; stripe_account_id?: string; charges_enabled?: boolean; payouts_enabled?: boolean }; connected?: boolean; error?: string }>}
 */
export async function getCoach(userId) {
  if (!userId) return { error: 'user_id required' };
  const { data, error } = await invokeSupabaseFunction('get-coach', { user_id: userId });
  if (error) return { error };
  return {
    coach: data?.coach ?? null,
    connected: !!data?.connected,
    charges_enabled: !!data?.charges_enabled,
    payouts_enabled: !!data?.payouts_enabled,
  };
}

/**
 * List services for a coach.
 * @param {string} userId
 * @param {string} [coachId]
 * @returns {Promise<{ services?: Array<{ id: string; name: string; description?: string; price_amount: number; currency: string; interval: string; stripe_price_id?: string; active: boolean }>; error?: string }>}
 */
export async function listServices(userId, coachId = null) {
  const { data, error } = await invokeSupabaseFunction('list-services', { user_id: userId, coach_id: coachId ?? undefined });
  if (error) return { error };
  return { services: data?.services ?? [] };
}

/**
 * Create or update a service (Stripe Product + Price), then save to DB.
 * @param {{ user_id?: string; coach_id?: string; service_id?: string; name: string; description?: string; price_amount: number; currency?: string; interval?: string; active?: boolean }} payload
 * @returns {Promise<{ service?: { id: string; stripe_price_id?: string }; error?: string }>}
 */
export async function stripeServiceUpsert(payload) {
  const { data, error } = await invokeSupabaseFunction('stripe-service-upsert', payload);
  if (error) return { error };
  return { service: data?.service ?? data };
}

/**
 * Create Checkout Session for trainer platform plan (Basic/Pro/Elite).
 * @param {{ user_id: string; plan_tier?: 'basic'|'pro'|'elite' }} payload
 * @returns {Promise<{ url?: string; session_id?: string; error?: string }>}
 */
export async function stripeCreatePlanCheckout(payload) {
  const { data, error } = await invokeSupabaseFunction('stripe-create-plan-checkout', payload);
  if (error) return { error };
  return { url: data?.url ?? null, session_id: data?.session_id ?? null };
}

/**
 * Create Checkout Session for a lead + service; returns URL to redirect.
 * @param {{ user_id?: string; coach_id?: string; service_id: string; lead_id?: string; lead_name?: string; lead_email: string }} payload
 * @returns {Promise<{ url?: string; session_id?: string; lead_id?: string; error?: string }>}
 */
export async function stripeCheckoutSession(payload) {
  const { data, error } = await invokeSupabaseFunction('stripe-checkout-session', payload);
  if (error) return { error };
  return {
    url: data?.url ?? null,
    session_id: data?.session_id ?? null,
    lead_id: data?.lead_id ?? null,
  };
}

/**
 * List review items (payment_overdue, intake_required) for Review Center.
 * @param {string} userId
 * @param {{ status?: string }} [opts]
 * @returns {Promise<{ items?: Array<{ id: string; client_id: string; type: string; status: string; dedupe_key: string }>; error?: string }>}
 */
export async function listReviewItems(userId, opts = {}) {
  const { data, error } = await invokeSupabaseFunction('list-review-items', { user_id: userId, status: opts.status ?? 'active' });
  if (error) return { error };
  return { items: data?.items ?? [] };
}

/**
 * Mark a review item as done (e.g. "Mark paid (manual)").
 * @param {string} itemId
 * @returns {Promise<{ ok?: boolean; error?: string }>}
 */
export async function completeReviewItem(itemId) {
  const { data, error } = await invokeSupabaseFunction('complete-review-item', { item_id: itemId, status: 'done' });
  if (error) return { error };
  return { ok: !!data?.ok };
}

/**
 * Mock services for demo / no Supabase.
 */
export const MOCK_SERVICES = [
  { id: 'mock-1', name: 'Online Coaching', description: 'Full online coaching', price_amount: 12000, currency: 'gbp', interval: 'month', stripe_price_id: null, active: true },
  { id: 'mock-2', name: 'Check-in Only', description: 'Check-ins and feedback', price_amount: 6000, currency: 'gbp', interval: 'month', stripe_price_id: null, active: true },
  { id: 'mock-3', name: 'Comp Prep', description: 'Competition prep package', price_amount: 18000, currency: 'gbp', interval: 'month', stripe_price_id: null, active: true },
];
