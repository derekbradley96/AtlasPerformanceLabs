/**
 * Client Health Score: single source of truth.
 * Component scores 0..weight, total 0..100. Reasons only from failed thresholds, max 4.
 * risk = 100 - score.
 */
import type { HealthScoreConfig } from './healthScoreConfig';
import type { PhaseKey } from '@/lib/health/shared';
import { getHealthScoreConfig } from './healthScoreConfig';
import { normalizePhase } from '@/lib/health/shared';

export type { PhaseKey } from '@/lib/health/shared';

export type HealthStatus = 'on_track' | 'monitor' | 'at_risk';

export interface CheckinLike {
  submitted_at?: string | null;
  created_date?: string | null;
  weight_kg?: number | null;
  adherence_pct?: number | null;
  metrics?: Record<string, number> | null;
}

export interface LiftEntry {
  date: string;
  liftKey: string;
  valueKg: number;
}

export interface MessageThreadLike {
  unread_count?: number;
  last_message_at?: string | null;
}

export interface PaymentLike {
  status?: string;
}

export interface FatigueInput {
  fatigueLevel: 'LOW' | 'MODERATE' | 'HIGH';
  fatigueScore?: number;
  strengthExplainedByFatigue?: boolean;
}

export interface HealthScoreInput {
  client: { baselineWeight?: number | null; baselineStrength?: Record<string, number> };
  phase: PhaseKey | string;
  goal?: string | null;
  checkins: CheckinLike[];
  lifts?: LiftEntry[] | null;
  messageThreads?: MessageThreadLike[];
  payments?: PaymentLike[];
  now?: number;
  config?: HealthScoreConfig;
  /** Energy/fatigue from evaluateFatigue; applies modifiers (e.g. HIGH -10, LOW +5, soften strength). */
  fatigue?: FatigueInput | null;
}

export interface HealthScoreResult {
  score: number;
  risk: number;
  status: HealthStatus;
  reasons: string[];
  breakdown: {
    adherence: number;
    checkinConsistency: number;
    goalAlignment: number;
    strengthTrend: number;
    engagement: number;
    payments: number;
  };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function getDate(entry: { submitted_at?: string | null; created_date?: string | null; date?: string }): number {
  const d = entry.submitted_at || entry.created_date || entry.date;
  return d ? new Date(d).getTime() : 0;
}

export function buildLiftsFromCheckins(checkins: CheckinLike[]): LiftEntry[] {
  const out: LiftEntry[] = [];
  (checkins || []).forEach((c) => {
    const date = c.submitted_at || c.created_date;
    if (!date || !c.metrics || typeof c.metrics !== 'object') return;
    Object.entries(c.metrics).forEach(([liftKey, valueKg]) => {
      if (typeof valueKg === 'number') out.push({ date: String(date), liftKey, valueKg });
    });
  });
  return out;
}

/**
 * Weight trend over window: first vs last (kg/week).
 */
function weightTrend(
  checkins: CheckinLike[],
  windowDays: number,
  now: number
): { trendPerWeekKg: number; direction: 'up' | 'down' | 'stable'; variancePct: number | null } {
  const cutoff = now - windowDays * MS_PER_DAY;
  const withWeight = (checkins || [])
    .filter((c) => c.weight_kg != null && getDate(c) >= cutoff)
    .map((c) => ({ at: getDate(c), weight: c.weight_kg! }))
    .sort((a, b) => a.at - b.at);
  if (withWeight.length < 2) {
    return { trendPerWeekKg: 0, direction: 'stable', variancePct: null };
  }
  const first = withWeight[0];
  const last = withWeight[withWeight.length - 1];
  const daysSpan = (last.at - first.at) / MS_PER_DAY;
  const weeks = Math.max(0.1, daysSpan / 7);
  const trendPerWeekKg = (last.weight - first.weight) / weeks;
  const direction: 'up' | 'down' | 'stable' =
    trendPerWeekKg > 0.05 ? 'up' : trendPerWeekKg < -0.05 ? 'down' : 'stable';
  const variancePct = first.weight > 0 ? Math.abs((last.weight - first.weight) / first.weight) * 100 : null;
  return { trendPerWeekKg, direction, variancePct };
}

/**
 * Strength trend: avg % change per lift in window.
 */
export function strengthTrend(
  lifts: LiftEntry[],
  keyLifts: string[],
  windowDays: number,
  now: number
): { avgChangePct: number; direction: 'up' | 'down' | 'stable' } {
  if (!keyLifts.length || !lifts.length) return { avgChangePct: 0, direction: 'stable' };
  const cutoff = now - windowDays * MS_PER_DAY;
  const inWindow = lifts.filter((e) => new Date(e.date).getTime() >= cutoff);
  const byLift: Record<string, { at: number; value: number }[]> = {};
  inWindow.forEach((e) => {
    if (!keyLifts.includes(e.liftKey)) return;
    if (!byLift[e.liftKey]) byLift[e.liftKey] = [];
    byLift[e.liftKey].push({ at: new Date(e.date).getTime(), value: e.valueKg });
  });
  let totalChange = 0;
  let count = 0;
  Object.values(byLift).forEach((list) => {
    const sorted = [...list].sort((a, b) => a.at - b.at);
    if (sorted.length < 2) return;
    const first = sorted[0].value;
    const last = sorted[sorted.length - 1].value;
    if (first && first !== 0) {
      totalChange += ((last - first) / first) * 100;
      count++;
    }
  });
  const avgChangePct = count > 0 ? totalChange / count : 0;
  const direction: 'up' | 'down' | 'stable' =
    avgChangePct > 1 ? 'up' : avgChangePct < -1 ? 'down' : 'stable';
  return { avgChangePct, direction };
}

/** Exported for fatigue/energy: strength trend from client + checkins. */
export function getStrengthTrendFromCheckins(
  client: { baselineStrength?: Record<string, number> | null },
  checkins: CheckinLike[],
  now: number
): { avgChangePct: number; direction: 'up' | 'down' | 'stable' } {
  const config = getHealthScoreConfig();
  const keyLifts = client?.baselineStrength
    ? Object.keys(client.baselineStrength).filter((k) => typeof client.baselineStrength![k] === 'number')
    : [];
  const lifts = buildLiftsFromCheckins(checkins);
  return strengthTrend(lifts, keyLifts, config.trendWindowDays, now);
}

export function computeHealthScore(input: HealthScoreInput): HealthScoreResult {
  const config = input.config ?? getHealthScoreConfig();
  const now = input.now ?? Date.now();
  const { client, checkins, payments = [], messageThreads = [] } = input;
  const phase = normalizePhase(input.phase);
  const w = config.weights;
  const trendWindow = config.trendWindowDays;
  const checkinWindow = config.checkinWindowDays;

  const submitted = (checkins || []).filter((c) => c.submitted_at || c.created_date);
  const inCheckinWindow = submitted.filter((c) => getDate(c) >= now - checkinWindow * MS_PER_DAY);
  const inTrendWindow = submitted.filter((c) => getDate(c) >= now - trendWindow * MS_PER_DAY);
  const checkinCount = inCheckinWindow.length;

  const lifts = input.lifts ?? buildLiftsFromCheckins(checkins);
  const keyLifts = client?.baselineStrength
    ? Object.keys(client.baselineStrength).filter((k) => typeof client.baselineStrength![k] === 'number')
    : [];
  const weight = weightTrend(checkins, trendWindow, now);
  const strength = strengthTrend(lifts, keyLifts, trendWindow, now);

  // --- 1) Fewer than 2 check-ins in last 28 days => cap 65 + reason
  const fewCheckins = checkinCount < config.minCheckinsInWindow;
  const reasons: string[] = [];
  if (fewCheckins) reasons.push('Fewer than 2 check-ins in last 4 weeks');

  // --- 2) Adherence < 60% over last 2 checkins => heavy penalty + reason
  const last2 = [...submitted].sort((a, b) => getDate(b) - getDate(a)).slice(0, 2);
  const adherencePct =
    last2.length && last2.every((c) => c.adherence_pct != null)
      ? last2.reduce((s, c) => s + (c.adherence_pct ?? 0), 0) / last2.length
      : null;
  const lowAdherence = adherencePct != null && adherencePct < config.adherenceMinPct;
  if (lowAdherence && adherencePct != null)
    reasons.push(`Adherence low: ${Math.round(adherencePct)}% (last 2 weeks)`);

  // Component: adherence (0..25). Heavy penalty when < 60%.
  const adherenceScore =
    adherencePct != null ? Math.min(100, Math.max(0, adherencePct)) : 80;
  const adherenceComponent = lowAdherence
    ? (adherenceScore / 100) * w.adherence * 0.2
    : (adherenceScore / 100) * w.adherence;

  // Component: checkin consistency (0..25) — fraction of weeks in window with at least one check-in
  const weekSet = new Set<number>();
  inCheckinWindow.forEach((c) => {
    const d = new Date(getDate(c));
    weekSet.add(d.getFullYear() * 53 + Math.floor(d.getDate() / 7));
  });
  const numWeeks = Math.ceil(checkinWindow / 7);
  const checkinConsistencyRatio = numWeeks > 0 ? Math.min(1, weekSet.size / numWeeks) : 0;
  const checkinConsistencyComponent = checkinConsistencyRatio * w.checkinConsistency;

  // --- 3) Phase-aware goalAlignment (0..20)
  let goalAlignmentComponent = w.goalAlignment;
  if (phase === 'cut' && weight.direction === 'up') {
    goalAlignmentComponent = 0;
    if (!reasons.some((r) => r.includes('weight') || r.includes('Weight')))
      reasons.push('Weight trending up during cut');
  } else if (phase === 'bulk' && weight.direction === 'down') {
    goalAlignmentComponent = 0;
    if (!reasons.some((r) => r.includes('weight') || r.includes('Weight')))
      reasons.push('Weight trending down during bulk');
  } else if (phase === 'maintenance' && weight.variancePct != null && weight.variancePct > config.maintenanceVariancePct) {
    goalAlignmentComponent = (1 - Math.min(1, weight.variancePct / 5)) * w.goalAlignment;
    if (!reasons.some((r) => r.includes('weight') || r.includes('Weight')))
      reasons.push(`Weight variance ${weight.variancePct.toFixed(1)}% in maintenance`);
  } else {
    goalAlignmentComponent = w.goalAlignment;
  }

  // --- 4) StrengthTrend: CUT small drop neutral, large penalty; BULK drop penalty
  let strengthComponent = w.strengthTrend;
  if (strength.direction === 'up') strengthComponent = w.strengthTrend;
  else if (strength.direction === 'stable') strengthComponent = w.strengthTrend * 0.9;
  else {
    const tol = phase === 'cut' ? config.strengthDropToleranceCut : config.strengthDropToleranceBulk;
    if (phase === 'cut' && strength.avgChangePct >= -tol) strengthComponent = w.strengthTrend * 0.8;
    else if (strength.avgChangePct < -tol) {
      strengthComponent = Math.max(0, w.strengthTrend * (1 + strength.avgChangePct / 20));
      if (!reasons.some((r) => r.includes('Strength') || r.includes('strength')))
        reasons.push(`Strength down ${Math.abs(strength.avgChangePct).toFixed(1)}%`);
    }
  }

  // --- 5) Engagement: unread messages or no client response in 7 days => penalty
  const hasUnread = messageThreads.some((t) => (t.unread_count ?? 0) > 0);
  const stale = messageThreads.some((t) => {
    const at = t.last_message_at ? new Date(t.last_message_at).getTime() : 0;
    return at > 0 && now - at > config.engagementStaleDays * MS_PER_DAY;
  });
  const engagementFail = hasUnread || stale;
  const engagementComponent = engagementFail ? w.engagement * 0.3 : w.engagement;
  if (hasUnread && !reasons.some((r) => r.includes('message') || r.includes('Unread')))
    reasons.push('Unread messages');
  if (stale && !hasUnread && !reasons.some((r) => r.includes('response') || r.includes('message')))
    reasons.push('No client response in 7+ days');

  // --- 6) Payments overdue => penalty + reason
  const hasOverdue = payments.some((p) => (p.status || '').toLowerCase() === 'overdue');
  const paymentsComponent = hasOverdue ? 0 : w.payments;
  if (hasOverdue) reasons.push('Payment overdue');

  // Total: sum components (each already scaled to 0..weight)
  let total =
    adherenceComponent +
    checkinConsistencyComponent +
    goalAlignmentComponent +
    strengthComponent +
    engagementComponent +
    paymentsComponent;

  // Energy/fatigue modifiers (~10% impact, no new queue item types)
  const fatigue = input.fatigue;
  if (fatigue) {
    if (fatigue.fatigueLevel === 'HIGH') total -= 10;
    else if (fatigue.fatigueLevel === 'LOW' && strengthComponent >= w.strengthTrend * 0.8) total += 5;
    if (fatigue.strengthExplainedByFatigue && strength.direction === 'down') {
      const strengthPenalty = w.strengthTrend - strengthComponent;
      total += Math.min(strengthPenalty * 0.5, 5);
    }
  }

  if (fewCheckins && total > 65) total = 65;
  const score = Math.round(Math.max(0, Math.min(100, total)));
  const risk = 100 - score;
  const status: HealthStatus =
    score >= config.onTrack ? 'on_track' : score >= config.monitor ? 'monitor' : 'at_risk';

  const breakdown = {
    adherence: Math.round((adherenceComponent / w.adherence) * 100),
    checkinConsistency: Math.round((checkinConsistencyComponent / w.checkinConsistency) * 100),
    goalAlignment: Math.round((goalAlignmentComponent / w.goalAlignment) * 100),
    strengthTrend: Math.round((strengthComponent / w.strengthTrend) * 100),
    engagement: Math.round((engagementComponent / w.engagement) * 100),
    payments: Math.round((paymentsComponent / w.payments) * 100),
  };

  return {
    score,
    risk,
    status,
    reasons: reasons.slice(0, 4),
    breakdown,
  };
}
