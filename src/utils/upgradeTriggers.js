import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { CURRENCY, PLANS } from '@/config/plans';

const MAJOR_SHOWN_SESSION_KEY = 'atlas_upgrade_major_prompt_shown';
const LAST_MAJOR_AT_KEY = 'atlas_upgrade_last_major_prompt_at';
const COOLDOWN_MS = 48 * 60 * 60 * 1000;

function toPlan(plan) {
  return String(plan || 'basic').trim().toLowerCase();
}

function toAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function basicFees(monthlyRevenue) {
  return toAmount(monthlyRevenue) * 0.1;
}

function proTotal(monthlyRevenue) {
  return 59 + toAmount(monthlyRevenue) * 0.03;
}

function eliteTotal() {
  return Number(PLANS.find((p) => p.id === 'elite')?.price ?? 89);
}

const PRO_FLAT = () => Number(PLANS.find((p) => p.id === 'pro')?.price ?? 59);
const ELITE_FLAT = () => Number(PLANS.find((p) => p.id === 'elite')?.price ?? 89);

/**
 * Illustration average revenue per client (GBP/mo) so "At 5 clients: Pro saves…" stays motivating when roster is empty.
 * Chosen so 5 × illustration × (10% − 3%) − £59 ≈ £14 vs Basic commission-only at same volume.
 */
export const ILLUSTRATION_AVG_MONTHLY_PER_CLIENT = 210;

/**
 * Compare effective monthly cost of staying on current tier vs the next tier up.
 * @param {{ clientCount: number, avgMonthlyRevenuePerClient?: number, currentTier?: string, monthlyRevenueEstimate?: number | null }} opts
 */
export function calculateUpgradeSaving({
  clientCount,
  avgMonthlyRevenuePerClient = 85,
  currentTier = 'basic',
  monthlyRevenueEstimate = null,
}) {
  const n = Math.max(0, Number(clientCount) || 0);
  const fromClients = n * Number(avgMonthlyRevenuePerClient) || 0;
  const monthlyRevenue =
    monthlyRevenueEstimate != null &&
    Number.isFinite(Number(monthlyRevenueEstimate)) &&
    Number(monthlyRevenueEstimate) > 0
      ? Number(monthlyRevenueEstimate)
      : fromClients;

  const tier = toPlan(currentTier);
  if (tier === 'elite') return null;

  if (tier === 'basic') {
    const currentCommission = monthlyRevenue * 0.1;
    const proCommission = monthlyRevenue * 0.03;
    const proMonthlyCost = PRO_FLAT();
    const currentEffectiveCost = currentCommission;
    const proEffectiveCost = proMonthlyCost + proCommission;
    const saving = currentEffectiveCost - proEffectiveCost;
    return {
      currentMonthlyCost: Math.round(currentCommission),
      upgradeMonthlyCost: Math.round(proEffectiveCost),
      monthlySaving: Math.round(saving),
      breakEvenClients: 5,
      worthUpgrading: saving > 0,
    };
  }

  if (tier === 'pro') {
    const proEffectiveCost = PRO_FLAT() + monthlyRevenue * 0.03;
    const eliteMonthlyCost = ELITE_FLAT();
    const saving = proEffectiveCost - eliteMonthlyCost;
    return {
      currentMonthlyCost: Math.round(proEffectiveCost),
      upgradeMonthlyCost: eliteMonthlyCost,
      monthlySaving: Math.round(saving),
      breakEvenClients: 12,
      worthUpgrading: saving > 0,
    };
  }

  return null;
}

/** Effective platform + plan cost for one tier at a given implied monthly client payment volume (GBP). */
export function coachPlanEffectiveMonthly(planTierId, { clientCount, avgMonthlyRevenuePerClient = 85, monthlyRevenueEstimate = null } = {}) {
  const tier = toPlan(planTierId);
  const n = Math.max(0, Number(clientCount) || 0);
  const fromClients = n * Number(avgMonthlyRevenuePerClient) || 0;
  const revenue =
    monthlyRevenueEstimate != null &&
    Number.isFinite(Number(monthlyRevenueEstimate)) &&
    Number(monthlyRevenueEstimate) > 0
      ? Number(monthlyRevenueEstimate)
      : fromClients;
  if (tier === 'basic') return Math.round(revenue * 0.1);
  if (tier === 'pro') return Math.round(PRO_FLAT() + revenue * 0.03);
  if (tier === 'elite') return Math.round(ELITE_FLAT());
  return Math.round(revenue * 0.1);
}

/**
 * Line under plan cards (onboarding / plan picker): concrete effective cost.
 * @param {{ planTierId: string, clientCount: number, monthlyRevenueEstimate?: number | null }} opts
 */
export function formatCoachPlanCardEffectiveLine({ planTierId, clientCount, monthlyRevenueEstimate = null }) {
  const n = Math.max(0, Number(clientCount) || 0);
  const eff = coachPlanEffectiveMonthly(planTierId, { clientCount: n, monthlyRevenueEstimate });
  if (n > 0) {
    return `At your current ${n} clients: ${CURRENCY}${eff}/month effective`;
  }
  const basicEff = coachPlanEffectiveMonthly('basic', {
    clientCount: 5,
    avgMonthlyRevenuePerClient: ILLUSTRATION_AVG_MONTHLY_PER_CLIENT,
  });
  const proEff = coachPlanEffectiveMonthly('pro', {
    clientCount: 5,
    avgMonthlyRevenuePerClient: ILLUSTRATION_AVG_MONTHLY_PER_CLIENT,
  });
  const save = Math.max(0, basicEff - proEff);
  return `At 5 clients: Pro saves you ${CURRENCY}${save}/month vs Basic`;
}

/**
 * Prompt object for coach home (canonical /home). Never shown below 8 clients (Basic→Pro).
 * Pro→Elite requires 12+ clients. Uses £85/client implied revenue unless monthlyRevenueEstimate is set.
 * Near-miss window: show when saving > -£5 vs next tier.
 */
export function buildCoachHomeUpgradePrompt({ planTier, clientCount, monthlyRevenueEstimate = null, dismissedId = null }) {
  const tier = toPlan(planTier);
  const n = Math.max(0, Number(clientCount) || 0);
  if (n < 8) return null;

  const revInput =
    monthlyRevenueEstimate != null &&
    Number.isFinite(Number(monthlyRevenueEstimate)) &&
    Number(monthlyRevenueEstimate) > 0
      ? Number(monthlyRevenueEstimate)
      : null;
  const monthlyRevenue = revInput != null ? revInput : n * 85;

  if (tier === 'basic') {
    const basicCommission = monthlyRevenue * 0.1;
    const proEffective = PRO_FLAT() + monthlyRevenue * 0.03;
    const saving = basicCommission - proEffective;
    if (saving <= -5) return null;
    const prompt = {
      id: 'basic_to_pro_savings',
      kind: 'major',
      variant: 'inline',
      title: `You're paying ${CURRENCY}${Math.round(basicCommission)}/month in commission`,
      body: `At ${n} clients, Pro costs ${CURRENCY}${Math.round(proEffective)}/month — ${
        saving > 0 ? `saving you ${CURRENCY}${Math.round(saving)}/month` : 'nearly at the crossover point'
      }.`,
      ctaLabel: 'Upgrade to Pro',
      metrics: { monthlySaving: Math.round(saving), clientCount: n, basicCommission, proEffective },
    };
    if (dismissedId && prompt.id === dismissedId) return null;
    return prompt;
  }

  if (tier === 'pro' && n >= 12) {
    const proEffective = PRO_FLAT() + monthlyRevenue * 0.03;
    const eliteFlat = eliteTotal();
    const eliteSaving = proEffective - eliteFlat;
    if (eliteSaving <= -5) return null;
    const proRounded = Math.round(proEffective);
    const savingRounded = Math.round(eliteSaving);
    const prompt = {
      id: 'pro_to_elite_savings',
      kind: 'major',
      variant: 'inline',
      title: 'Elite is now worth it for you',
      body:
        eliteSaving > 0
          ? `At ${n} clients, Pro costs you ${CURRENCY}${proRounded}/month. Elite is ${CURRENCY}${eliteFlat} flat — saving you ${CURRENCY}${savingRounded}/month. Plus: your own brand, not ours.`
          : `At ${n} clients, Pro costs you ${CURRENCY}${proRounded}/month. Elite is ${CURRENCY}${eliteFlat} flat — same ballpark with white-label, 0% commission, and priority support.`,
      ctaLabel: `Upgrade to Elite — ${CURRENCY}${eliteFlat}/month`,
      metrics: { monthlySaving: savingRounded, clientCount: n, proEffective, eliteFlat },
    };
    if (dismissedId && prompt.id === dismissedId) return null;
    return prompt;
  }

  return null;
}

export function buildUpgradeInputs(raw = {}) {
  return {
    clientCount: Math.max(0, Number(raw.clientCount) || 0),
    monthlyRevenue: toAmount(raw.monthlyRevenue),
    lastPaymentAmount: toAmount(raw.lastPaymentAmount),
    currentPlan: toPlan(raw.currentPlan),
    billingState: raw.billingState && typeof raw.billingState === 'object' ? raw.billingState : null,
  };
}

export function evaluateUpgradeTriggers(raw = {}) {
  const input = buildUpgradeInputs(raw);
  const state = input.billingState || {};
  const currentPlan = toPlan(state.plan_tier || input.currentPlan);
  const monthlyRevenue = toAmount(state.monthly_revenue_estimate ?? input.monthlyRevenue);
  const monthlyFeesEstimate = toAmount(state.monthly_fees_estimate);
  const stateRecommended = toPlan(state.recommended_plan || '');
  const effectiveLostMonthlyVsPro = Math.max(0, basicFees(monthlyRevenue) - proTotal(monthlyRevenue));
  const weeklyLostVsPro = effectiveLostMonthlyVsPro / 4.33;
  const prompts = [];

  const revenueForSaving =
    monthlyRevenue > 0 ? monthlyRevenue : null;

  const homePrompt = buildCoachHomeUpgradePrompt({
    planTier: currentPlan,
    clientCount: input.clientCount,
    monthlyRevenueEstimate: revenueForSaving,
    dismissedId: null,
  });
  if (homePrompt) prompts.push(homePrompt);

  if (input.lastPaymentAmount > 0 && currentPlan === 'basic') {
    const basicOnPayment = basicFees(input.lastPaymentAmount);
    const proOnPayment = input.lastPaymentAmount * 0.03;
    prompts.push({
      id: 'payment_fee_compare',
      kind: 'minor',
      variant: 'inline',
      title: 'Payment processed',
      body: `This payment cost ~£${Math.round(basicOnPayment)} on Basic. Pro commission would be ~£${Math.round(proOnPayment)} (+ monthly plan).`,
      ctaLabel: 'Compare plans',
      metrics: { basicOnPayment, proOnPayment },
    });
  }

  if (weeklyLostVsPro > 20 && currentPlan === 'basic') {
    prompts.push({
      id: 'weekly_commission_summary',
      kind: 'minor',
      variant: 'inline',
      title: 'Weekly fee summary',
      body: `Estimated commission drag this week vs Pro: ~${CURRENCY}${Math.round(weeklyLostVsPro)}. Numbers above reflect your full-month estimate when revenue is available.`,
      ctaLabel: 'Review savings',
      metrics: { weeklyLostVsPro },
    });
  }

  if (input.clientCount >= 20 && currentPlan !== 'elite') {
    const recommended = stateRecommended === 'elite' ? 'elite' : currentPlan === 'basic' ? 'pro' : 'elite';
    prompts.push({
      id: 'elite_scale_recommendation',
      kind: 'minor',
      variant: 'inline',
      title: "You're growing",
      body: recommended === 'elite'
        ? 'At 20+ clients, Elite is built for full rosters and removes commission drag.'
        : 'At 20+ clients, start with Pro now and move to Elite as you scale further.',
      ctaLabel: 'See plans',
      metrics: { recommended, eliteTotal: eliteTotal() },
    });
  }

  return {
    input,
    prompts,
    estimates: {
      basicMonthlyFees: basicFees(input.monthlyRevenue),
      proMonthlyTotal: proTotal(input.monthlyRevenue),
      eliteMonthlyTotal: eliteTotal(),
      lostMonthlyVsPro: effectiveLostMonthlyVsPro,
      weeklyLostVsPro,
      monthlyRevenue,
      monthlyFeesEstimate,
    },
  };
}

export function canShowMajorPrompt(now = Date.now(), { strongerThreshold = false } = {}) {
  try {
    const shownThisSession = sessionStorage.getItem(MAJOR_SHOWN_SESSION_KEY) === '1';
    if (shownThisSession && !strongerThreshold) return false;
    const lastShown = Number(localStorage.getItem(LAST_MAJOR_AT_KEY) || 0);
    return strongerThreshold || !lastShown || now - lastShown >= COOLDOWN_MS;
  } catch {
    return true;
  }
}

export function markMajorPromptShown(now = Date.now()) {
  try {
    sessionStorage.setItem(MAJOR_SHOWN_SESSION_KEY, '1');
    localStorage.setItem(LAST_MAJOR_AT_KEY, String(now));
  } catch {
    // ignore storage errors
  }
}

export function resetUpgradePromptFrequencyGuards() {
  try {
    sessionStorage.removeItem(MAJOR_SHOWN_SESSION_KEY);
    localStorage.removeItem(LAST_MAJOR_AT_KEY);
  } catch {
    // ignore storage errors
  }
}

export function selectUpgradePrompt(prompts = [], { allowMajor = true } = {}) {
  if (!Array.isArray(prompts) || prompts.length === 0) return null;
  const major = prompts.find((p) => p.kind === 'major');
  const lost = Number(major?.metrics?.lostMonthlyVsPro) || 0;
  const saving = Number(major?.metrics?.monthlySaving) || 0;
  const strongerThreshold = Boolean(lost >= 100 || saving >= 120);
  if (major && allowMajor && canShowMajorPrompt(Date.now(), { strongerThreshold })) return major;
  return prompts.find((p) => p.kind !== 'major') || null;
}

export async function trackUpgradePromptEvent({
  eventType,
  promptId, // trigger_type
  userId = null, // coach_id
  properties = {}, // context_json
}) {
  if (!eventType || !promptId || !hasSupabase) return;
  const supabase = getSupabase();
  if (!supabase) return;

  const context = properties && typeof properties === 'object' ? properties : {};
  const nowIso = new Date().toISOString();
  const payload = { coach_id: userId || null, trigger_type: String(promptId), context_json: context };
  if (!payload.coach_id) return;
  if (eventType === 'shown') payload.shown_at = nowIso;
  if (eventType === 'clicked') payload.clicked_at = nowIso;
  if (eventType === 'converted') payload.converted_at = nowIso;

  try {
    const { error } = await supabase.from('upgrade_trigger_events').insert(payload);
    if (!error) return;
  } catch {
    // fallback below
  }

  try {
    await supabase.from('platform_usage_events').insert({
      event_name: `upgrade_prompt_${String(eventType)}`,
      user_id: userId || null,
      properties: {
        prompt_id: String(promptId),
        ...(payload.properties || {}),
      },
    });
  } catch {
    // non-blocking analytics
  }
}
