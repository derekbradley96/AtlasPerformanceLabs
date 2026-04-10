/**
 * Coach Stripe Connect readiness for payouts (shared: onboarding, home reminder, marketplace).
 * Uses get-coach edge function; demo uses stripeConnectStore.
 */
import { getCoach } from '@/lib/supabaseStripeApi';
import { isStripeConnected } from '@/lib/stripeConnectStore';
import { hasSupabase } from '@/lib/supabaseClient';

/**
 * @param {string | null} userId
 * @param {boolean} isDemoMode
 * @returns {Promise<{ ready: boolean, stripe_account_id?: string | null, charges_enabled?: boolean }>}
 */
export async function fetchCoachPayoutReady(userId, isDemoMode) {
  if (!userId) return { ready: false, stripe_account_id: null };
  if (isDemoMode) {
    return { ready: isStripeConnected(), stripe_account_id: null };
  }
  if (!hasSupabase) return { ready: false, stripe_account_id: null };
  try {
    const res = await getCoach(userId);
    if (res?.error) return { ready: false, stripe_account_id: null };
    const id = res.coach?.stripe_account_id ?? null;
    const ready = !!(res.connected || id);
    return {
      ready,
      stripe_account_id: id,
      charges_enabled: !!res.charges_enabled,
    };
  } catch {
    return { ready: false, stripe_account_id: null };
  }
}
