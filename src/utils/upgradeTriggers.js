import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

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
  return 79;
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

  if (currentPlan === 'basic' && input.clientCount >= 8) {
    prompts.push({
      id: 'pro_saves_money',
      kind: 'major',
      variant: 'banner',
      title: "You're growing",
      body: `You're now at the point where Pro saves money. Basic is costing ~£${Math.round(effectiveLostMonthlyVsPro)} more this month.`,
      ctaLabel: 'See Pro',
      metrics: { lostMonthlyVsPro: effectiveLostMonthlyVsPro },
    });
  }

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
      kind: 'major',
      variant: 'inline',
      title: 'Weekly fee summary',
      body: `Estimated commission lost this week: ~£${Math.round(weeklyLostVsPro)}. Pro typically reduces this drag as your roster grows.`,
      ctaLabel: 'Review savings',
      metrics: { weeklyLostVsPro },
    });
  }

  if (input.clientCount >= 20 && currentPlan !== 'elite') {
    const recommended = stateRecommended === 'elite' ? 'elite' : currentPlan === 'basic' ? 'pro' : 'elite';
    prompts.push({
      id: 'elite_scale_recommendation',
      kind: 'major',
      variant: 'inline',
      title: "You're growing",
      body: recommended === 'elite'
        ? 'At 20+ clients, Elite is built for full rosters and removes commission drag.'
        : 'At 20+ clients, start with Pro now and move to Elite as you scale further.',
      ctaLabel: 'See plans',
      metrics: { recommended, eliteTotal: eliteTotal() },
    });
  }

  if (stateRecommended === 'elite' && currentPlan === 'pro') {
    prompts.push({
      id: 'elite_cheaper_than_pro',
      kind: 'major',
      variant: 'inline',
      title: 'Elite crossover reached',
      body: 'At your current volume, Elite now costs less than Pro.',
      ctaLabel: 'View Elite',
      metrics: { stateRecommended },
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
  const strongerThreshold = Boolean(major?.metrics?.lostMonthlyVsPro >= 100);
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
