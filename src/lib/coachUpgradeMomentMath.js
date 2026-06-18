/**
 * Platform fee comparison for coach upgrade moments (GBP, aligns with config/plans Basic 10% vs Pro £59 + 3%).
 *
 * Example at £100/client/month: at 12 clients (£1,200 volume), Basic ≈ £120 fees, Pro ≈ £59 + £36 = £95,
 * Elite = £89 flat — Elite beats Pro from ~12 clients upward at that average.
 */

export const PRO_MONTHLY_GBP = 59;
export const ELITE_MONTHLY_GBP = 89;
export const BASIC_COMMISSION_RATE = 0.1;
export const PRO_COMMISSION_RATE = 0.03;

/**
 * @param {number} volume - Payment volume in GBP (e.g. last 30 days)
 */
export function basicFeesOnVolume(volume) {
  const v = Math.max(0, Number(volume) || 0);
  return v * BASIC_COMMISSION_RATE;
}

/**
 * Pro subscription + commission on same volume
 */
export function proTotalOnVolume(volume) {
  const v = Math.max(0, Number(volume) || 0);
  return PRO_MONTHLY_GBP + v * PRO_COMMISSION_RATE;
}

/**
 * Elite fixed fee only (0% commission)
 */
export function eliteTotalOnVolume() {
  return ELITE_MONTHLY_GBP;
}

/** Positive = Pro is cheaper than Basic fees alone (not counting you'll pay £59) */
export function proVersusBasicSavings(volume) {
  return basicFeesOnVolume(volume) - proTotalOnVolume(volume);
}

export function formatGbpWhole(n) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
}
