/**
 * Gym / studio affiliate tracking: session key + post-signup row in affiliate_referrals.
 * Uses RPC lookup_active_affiliate_id (see migration 20260425020000_affiliate_programme.sql).
 */
export const AFFILIATE_REF_SESSION_KEY = 'atlas_affiliate_ref';

/**
 * After email/password signup with a session, attach referred user to an active affiliate if ref was stored.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ id: string, email?: string|null }} user
 * @param {'coach'|'client'|'personal'} roleForMetadata
 */
export async function recordAffiliateReferralAfterSignup(supabase, user, roleForMetadata) {
  if (typeof sessionStorage === 'undefined' || !supabase || !user?.id) return;
  const raw = sessionStorage.getItem(AFFILIATE_REF_SESSION_KEY);
  const affiliateRef = (raw ?? '').toString().trim();
  if (!affiliateRef) return;

  try {
    const { data: affiliateId, error: rpcErr } = await supabase.rpc('lookup_active_affiliate_id', {
      p_code: affiliateRef,
    });
    if (rpcErr || !affiliateId) return;

    const referralType = roleForMetadata === 'coach' ? 'coach_signup' : 'client_signup';

    const { error: insErr } = await supabase.from('affiliate_referrals').insert({
      affiliate_id: affiliateId,
      referred_user_id: user.id,
      referred_email: user.email ?? null,
      referral_type: referralType,
    });

    if (!insErr) {
      sessionStorage.removeItem(AFFILIATE_REF_SESSION_KEY);
    }
  } catch {
    // Non-fatal: signup still succeeds
  }
}
