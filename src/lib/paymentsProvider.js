/**
 * Payments provider abstraction for Atlas: manual vs Stripe.
 * Keeps manual billing flow intact; Stripe integration can be added behind the same API.
 * No hard Stripe dependency: stripe provider can be no-op or call Stripe when configured.
 */

import { getSupabase } from '@/lib/supabaseClient';

/** Provider type: 'manual' | 'stripe' */
const PROVIDERS = Object.freeze({ MANUAL: 'manual', STRIPE: 'stripe' });

let currentProvider = PROVIDERS.MANUAL;

function getEnv(key) {
  if (typeof import.meta === 'undefined' || !import.meta.env) return '';
  const v = import.meta.env[key];
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Get the active payments provider.
 * @returns {'manual' | 'stripe'}
 */
export function getProvider() {
  const env = getEnv('VITE_PAYMENTS_PROVIDER');
  if (env === 'stripe' || env === 'manual') return env;
  return currentProvider;
}

/**
 * Set the active payments provider (e.g. for tests or runtime switch).
 * @param {'manual' | 'stripe'} provider
 */
export function setProvider(provider) {
  if (provider === PROVIDERS.MANUAL || provider === PROVIDERS.STRIPE) {
    currentProvider = provider;
  }
}

/**
 * Create a client subscription record.
 * Manual: inserts into client_subscriptions.
 * Stripe: same insert (Stripe subscription creation can be done elsewhere, e.g. checkout); or future: create Stripe subscription then insert.
 *
 * @param {Object} params
 * @param {string} params.clientId - client UUID
 * @param {string} [params.coachId] - coach profile UUID
 * @param {string} [params.organisationId] - organisation UUID
 * @param {string} [params.planName]
 * @param {number} [params.price]
 * @param {string} [params.currency='GBP']
 * @param {string} [params.billingInterval]
 * @param {string} [params.status='active']
 * @param {string} [params.startDate] - YYYY-MM-DD
 * @param {string} [params.nextBillingDate] - YYYY-MM-DD
 * @param {import('@supabase/supabase-js').SupabaseClient} [params.supabase] - optional client; uses getSupabase() if omitted
 * @returns {Promise<{ subscriptionId: string } | { error: Error }>}
 */
export async function createClientSubscription(params) {
  const supabase = params.supabase ?? getSupabase();
  if (!supabase) return { error: new Error('Supabase not configured') };

  const row = {
    client_id: params.clientId,
    coach_id: params.coachId ?? null,
    organisation_id: params.organisationId ?? null,
    plan_name: params.planName ?? null,
    price: params.price ?? null,
    currency: params.currency ?? 'GBP',
    billing_interval: params.billingInterval ?? null,
    status: params.status ?? 'active',
    start_date: params.startDate ?? null,
    next_billing_date: params.nextBillingDate ?? null,
  };

  const { data, error } = await supabase.from('client_subscriptions').insert(row).select('id').single();
  if (error) return { error };
  return { subscriptionId: data.id };
}

/**
 * Record a payment (manual or from Stripe webhook).
 * Both providers write to client_payments; manual = coach recorded, stripe = webhook sync.
 *
 * @param {Object} params
 * @param {string} params.clientId
 * @param {string} params.coachId
 * @param {number} params.amount
 * @param {string} [params.currency='GBP']
 * @param {string} [params.status='paid'] - 'paid' | 'pending' | 'failed' | 'refunded'
 * @param {string} [params.subscriptionId]
 * @param {string} [params.organisationId]
 * @param {string} [params.paymentProvider] - 'stripe' | 'manual'
 * @param {string} [params.providerPaymentId] - Stripe payment_intent.id etc.
 * @param {string} [params.paidAt] - ISO timestamp
 * @param {import('@supabase/supabase-js').SupabaseClient} [params.supabase]
 * @returns {Promise<{ paymentId: string } | { error: Error }>}
 */
export async function recordPayment(params) {
  const supabase = params.supabase ?? getSupabase();
  if (!supabase) return { error: new Error('Supabase not configured') };

  const provider = getProvider();
  const row = {
    client_id: params.clientId,
    coach_id: params.coachId,
    subscription_id: params.subscriptionId ?? null,
    organisation_id: params.organisationId ?? null,
    amount: params.amount,
    currency: params.currency ?? 'GBP',
    status: params.status ?? 'paid',
    payment_provider: params.paymentProvider ?? provider,
    provider_payment_id: params.providerPaymentId ?? null,
    paid_at: params.paidAt ?? (params.status === 'paid' ? new Date().toISOString() : null),
  };

  const { data, error } = await supabase.from('client_payments').insert(row).select('id').single();
  if (error) return { error };
  return { paymentId: data.id };
}

/**
 * Handle successful payment: update subscription next_billing_date and status.
 * Used after manual "Mark payment received" or after Stripe webhook payment success.
 *
 * @param {Object} params
 * @param {string} [params.subscriptionId] - if provided, advance this subscription
 * @param {string} [params.clientId] - used to resolve subscription if subscriptionId omitted
 * @param {string} [params.paymentId]
 * @param {number} [params.advanceMonths=1]
 * @param {import('@supabase/supabase-js').SupabaseClient} [params.supabase]
 * @returns {Promise<{ ok: boolean } | { error: Error }>}
 */
export async function handlePaymentSuccess(params) {
  const supabase = params.supabase ?? getSupabase();
  if (!supabase) return { error: new Error('Supabase not configured') };

  let subscriptionId = params.subscriptionId;
  if (!subscriptionId && params.clientId) {
    const { data } = await supabase
      .from('client_subscriptions')
      .select('id, next_billing_date')
      .eq('client_id', params.clientId)
      .in('status', ['active', 'overdue'])
      .order('next_billing_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    subscriptionId = data?.id ?? null;
  }

  if (!subscriptionId) return { ok: true };

  const advanceMonths = params.advanceMonths ?? 1;
  const { data: sub } = await supabase.from('client_subscriptions').select('next_billing_date').eq('id', subscriptionId).single();
  let nextDate = sub?.next_billing_date ? new Date(sub.next_billing_date) : new Date();
  nextDate.setMonth(nextDate.getMonth() + advanceMonths);

  const { error } = await supabase
    .from('client_subscriptions')
    .update({ next_billing_date: nextDate.toISOString().slice(0, 10), status: 'active' })
    .eq('id', subscriptionId);

  if (error) return { error };
  return { ok: true };
}

/**
 * Handle failed payment: mark subscription overdue (or leave as-is for retries).
 *
 * @param {Object} params
 * @param {string} [params.subscriptionId]
 * @param {string} [params.clientId]
 * @param {string} [params.paymentId]
 * @param {import('@supabase/supabase-js').SupabaseClient} [params.supabase]
 * @returns {Promise<{ ok: boolean } | { error: Error }>}
 */
export async function handlePaymentFailure(params) {
  const supabase = params.supabase ?? getSupabase();
  if (!supabase) return { error: new Error('Supabase not configured') };

  let subscriptionId = params.subscriptionId;
  if (!subscriptionId && params.clientId) {
    const { data } = await supabase
      .from('client_subscriptions')
      .select('id')
      .eq('client_id', params.clientId)
      .in('status', ['active'])
      .order('next_billing_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    subscriptionId = data?.id ?? null;
  }

  if (!subscriptionId) return { ok: true };

  const { error } = await supabase
    .from('client_subscriptions')
    .update({ status: 'overdue' })
    .eq('id', subscriptionId);

  if (error) return { error };
  return { ok: true };
}

export { PROVIDERS };
