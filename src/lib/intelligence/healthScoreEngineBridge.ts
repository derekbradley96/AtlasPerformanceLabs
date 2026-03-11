/**
 * Bridge: build phase-aware health score inputs from client + check-ins,
 * call calculateHealthScore. Pure for memoization.
 */
import type { HealthScoreInput, HealthScoreResult } from './healthScoreEngine';
import { calculateHealthScore } from './healthScoreEngine';
import { getClientPhase } from '@/lib/clientPhaseStore';

const MS_7_DAYS = 7 * 24 * 60 * 60 * 1000;

/** Stored phase (Cut, Maintenance, etc.) to engine phase. */
function toEnginePhase(
  storedPhase: string,
  showDate?: string | null
): HealthScoreInput['phase'] {
  const show = showDate ? new Date(showDate).getTime() : null;
  const now = Date.now();
  if (show != null) {
    const daysOut = Math.ceil((show - now) / (24 * 60 * 60 * 1000));
    if (daysOut <= 7 && daysOut >= 0) return 'peak';
  }
  const p = (storedPhase || '').toLowerCase().replace(/\s/g, '');
  if (p === 'cut') return 'prep';
  return 'offseason';
}

/** Days until show; null if no show or past. */
function daysOutFromShow(showDate?: string | null): number | null {
  if (!showDate) return null;
  const show = new Date(showDate).getTime();
  const now = Date.now();
  const days = Math.ceil((show - now) / (24 * 60 * 60 * 1000));
  return days >= 0 ? days : null;
}

/** Weight trend kg over last 7 days from check-ins. */
function weightTrendKg(
  checkIns: Array<{ submitted_at?: string | null; created_date?: string | null; weight_kg?: number | null }>
): number {
  const cutoff = Date.now() - MS_7_DAYS;
  const withWeight = (checkIns || [])
    .filter(
      (c) =>
        c.weight_kg != null &&
        (new Date(c.submitted_at || c.created_date || 0).getTime() >= cutoff)
    )
    .map((c) => ({
      at: new Date(c.submitted_at || c.created_date || 0).getTime(),
      weight: c.weight_kg,
    }))
    .sort((a, b) => a.at - b.at);
  if (withWeight.length < 2) return 0;
  const first = withWeight[0].weight as number;
  const last = withWeight[withWeight.length - 1].weight as number;
  const daysSpan =
    (withWeight[withWeight.length - 1].at - withWeight[0].at) /
    (24 * 60 * 60 * 1000);
  const weeks = Math.max(0.1, daysSpan / 7);
  return (last - first) / weeks;
}

/** Strength trend % from check-ins metrics (e.g. key lift delta). Default 0. */
function strengthTrendPct(
  checkIns: Array<{
    submitted_at?: string | null;
    created_date?: string | null;
    metrics?: Record<string, number> | null;
  }>
): number {
  const withMetrics = (checkIns || []).filter(
    (c) => c.metrics && typeof c.metrics === 'object'
  );
  if (withMetrics.length < 2) return 0;
  const sorted = [...withMetrics].sort(
    (a, b) =>
      new Date(b.submitted_at || b.created_date || 0).getTime() -
      new Date(a.submitted_at || a.created_date || 0).getTime()
  );
  const recent = sorted[0].metrics || {};
  const older = sorted[sorted.length - 1].metrics || {};
  const keys = Object.keys(recent).filter((k) => typeof older[k] === 'number');
  if (keys.length === 0) return 0;
  let sumPct = 0;
  keys.forEach((k) => {
    const prev = older[k] as number;
    const curr = recent[k] as number;
    if (prev > 0) sumPct += ((curr - prev) / prev) * 100;
  });
  return keys.length ? sumPct / keys.length : 0;
}

/** Recent submitted check-ins, newest first. */
function recentSubmitted(
  checkIns: CheckinLike[],
  limit = 4
): CheckinLike[] {
  return (checkIns || [])
    .filter((c) => c.status === 'submitted')
    .sort(
      (a, b) =>
        new Date(b.submitted_at || b.created_date || 0).getTime() -
        new Date(a.submitted_at || a.created_date || 0).getTime()
    )
    .slice(0, limit);
}

/** 0–100 from adherence_pct average. */
function adherenceFromCheckins(
  checkIns: Array<{ adherence_pct?: number | null }>
): number {
  const vals = (checkIns || [])
    .map((c) => c.adherence_pct)
    .filter((v) => typeof v === 'number') as number[];
  if (vals.length === 0) return 100;
  return Math.round(
    vals.reduce((a, b) => a + b, 0) / vals.length
  );
}

/** 0–100 steps compliance: use adherence as proxy if no steps target. */
function stepsComplianceFromCheckins(
  checkIns: Array<{ steps?: number | null; adherence_pct?: number | null }>
): number {
  const withSteps = (checkIns || []).filter((c) => c.steps != null);
  if (withSteps.length === 0) {
    const adh = adherenceFromCheckins(checkIns);
    return adh;
  }
  return adherenceFromCheckins(withSteps);
}

/** 0–100 cardio: use adherence as proxy. */
function cardioComplianceFromCheckins(
  checkIns: Array<{ adherence_pct?: number | null }>
): number {
  return adherenceFromCheckins(checkIns);
}

/** Average sleep hours. */
function sleepAvgFromCheckins(
  checkIns: Array<{ sleep_hours?: number | null }>
): number {
  const vals = (checkIns || [])
    .map((c) => c.sleep_hours)
    .filter((v) => typeof v === 'number') as number[];
  if (vals.length === 0) return 7;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

/** Mood 1–5 from metrics or default. */
function moodFromCheckins(
  checkIns: Array<{ metrics?: Record<string, number> | null }>
): number {
  const recent = (checkIns || []).slice(0, 2);
  for (const c of recent) {
    const m = c.metrics?.mood ?? c.metrics?.energy;
    if (typeof m === 'number' && m >= 1 && m <= 5) return Math.round(m);
  }
  return 4;
}

export interface ClientLike {
  id?: string;
  phase?: string | null;
  showDate?: string | null;
}

export interface CheckinLike {
  status?: string;
  submitted_at?: string | null;
  created_date?: string | null;
  weight_kg?: number | null;
  adherence_pct?: number | null;
  steps?: number | null;
  sleep_hours?: number | null;
  metrics?: Record<string, number> | null;
}

/**
 * Pure: build phase-aware health result from client + check-ins.
 * Memoize by (client, checkIns) in callers.
 */
export function getPhaseAwareHealthResult(
  client: ClientLike | null,
  checkIns: CheckinLike[]
): HealthScoreResult & { phase: HealthScoreInput['phase'] } {
  const storedPhase = client
    ? getClientPhase(client.id ?? '', client)
    : 'Maintenance';
  const phase = toEnginePhase(
    storedPhase,
    client?.showDate ?? null
  );
  const submitted = recentSubmitted(checkIns ?? [], 6);
  const weightTrend = weightTrendKg(submitted);
  const strengthTrend = strengthTrendPct(submitted);
  const stepsCompliance = stepsComplianceFromCheckins(submitted);
  const cardioCompliance = cardioComplianceFromCheckins(submitted);
  const adherence = adherenceFromCheckins(submitted);
  const sleepAvg = sleepAvgFromCheckins(submitted);
  const mood = moodFromCheckins(submitted);
  const daysOut = daysOutFromShow(client?.showDate ?? null);

  const input: HealthScoreInput = {
    phase,
    weightTrend,
    strengthTrend,
    stepsCompliance,
    cardioCompliance,
    adherence,
    sleepAvg,
    mood,
    daysOut,
  };

  const result = calculateHealthScore(input);
  return { ...result, phase };
}
