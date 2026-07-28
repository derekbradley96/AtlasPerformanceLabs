export const ATLAS_PLAN_MONTHLY = {
  basic: 0,
  pro: 59,
  elite: 89,
} as const;

export const ATLAS_PLAN_COMMISSION = {
  basic: 0.1,
  pro: 0.03,
  elite: 0,
} as const;

export type AtlasPlanTier = "basic" | "pro" | "elite";

export function toAtlasPlanTier(raw: unknown): AtlasPlanTier {
  const tier = String(raw ?? "basic").trim().toLowerCase();
  if (tier === "elite") return "elite";
  if (tier === "pro") return "pro";
  return "basic";
}

export function computeMonthlyVolumeEstimate(amount: unknown): number {
  return Math.max(0, Number(amount) || 0);
}

export function computeEffectiveMonthlyCosts(monthlyVolume: number) {
  const volume = computeMonthlyVolumeEstimate(monthlyVolume);
  return {
    basic: ATLAS_PLAN_MONTHLY.basic + volume * ATLAS_PLAN_COMMISSION.basic,
    pro: ATLAS_PLAN_MONTHLY.pro + volume * ATLAS_PLAN_COMMISSION.pro,
    elite: ATLAS_PLAN_MONTHLY.elite,
  };
}

export function computeRecommendedPlan(monthlyVolume: number): AtlasPlanTier {
  const costs = computeEffectiveMonthlyCosts(monthlyVolume);
  if (costs.elite <= costs.pro && costs.elite <= costs.basic) return "elite";
  if (costs.pro <= costs.basic) return "pro";
  return "basic";
}

/**
 * The tier a coach is actually ENTITLED to. profiles.plan_tier is written by
 * onboarding on selection — before any payment — so anything outward-facing
 * (white-label branding, marketplace badge) must gate on the subscription
 * actually existing. past_due keeps features through a payment retry window;
 * everything else falls back to basic.
 */
export function entitledPlanTier(planTier: unknown, subscriptionStatus: unknown): AtlasPlanTier {
  const tier = toAtlasPlanTier(planTier);
  if (tier === "basic") return "basic";
  const status = String(subscriptionStatus ?? "").trim().toLowerCase();
  return status === "active" || status === "trialing" || status === "past_due" ? tier : "basic";
}
