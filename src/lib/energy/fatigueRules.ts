/**
 * Fatigue detection from energy, sleep, strength, and phase.
 * Feeds health score modifiers and intervention recovery section. Never writes training plans.
 */
import { listLogs, getRollingAverage } from './energyRepo';
import { getClientById, getClientCheckIns } from '@/data/selectors';
import { getClientPhase } from '@/lib/clientPhaseStore';
import { getHealthScoreConfig } from '@/lib/intelligence/healthScoreConfig';
import { getStrengthTrendFromCheckins } from '@/lib/intelligence/healthScore';
import { normalizePhase, type PhaseKey } from '@/lib/health/shared';

export type FatigueLevel = 'LOW' | 'MODERATE' | 'HIGH';

export interface FatigueResult {
  fatigueLevel: FatigueLevel;
  signals: string[];
  fatigueScore: number;
  /** When true, strength drop is attributed to fatigue so health score can soften strength penalty. */
  strengthExplainedByFatigue?: boolean;
  /** When true, strength drop in cut is within expected tolerance (do not flag as risk). */
  expectedCutSuppression?: boolean;
  /** Performance concern in bulk despite decent energy (non-fatigue). */
  bulkPerformanceConcern?: boolean;
}

export interface FatigueContext {
  now?: Date;
}

const ROLLING_DAYS = 7;
const LOW_ENERGY_THRESHOLD = 5.5;
const ENERGY_STRENGTH_CORR_THRESHOLD = 6;
const SEVERE_CONSECUTIVE = 3;
const SEVERE_ENERGY_MAX = 4;
const SLEEP_LOW_H = 6.5;

/**
 * Evaluate fatigue for a client. Uses energy logs, optional sleep, phase, and strength trend.
 */
export function evaluateFatigue(clientId: string, context: FatigueContext = {}): FatigueResult {
  const now = context.now ?? new Date();
  const nowMs = now.getTime();
  const signals: string[] = [];
  let fatigueScore = 0;
  let strengthExplainedByFatigue = false;
  let expectedCutSuppression = false;
  let bulkPerformanceConcern = false;

  const { energyAvg, sleepAvg, count: logCount } = getRollingAverage(clientId, ROLLING_DAYS);
  const logs = listLogs(clientId, ROLLING_DAYS);

  const client = getClientById(clientId);
  const phase = normalizePhase(getClientPhase(clientId, client));
  const config = getHealthScoreConfig();
  const toleranceCut = config.strengthDropToleranceCut;
  const toleranceBulk = config.strengthDropToleranceBulk;

  const submitted = (client ? getClientCheckIns(clientId) : []).filter(
    (c: { status: string }) => c.status === 'submitted'
  );
  const strength = client
    ? getStrengthTrendFromCheckins(
        { baselineStrength: (client.baselineStrength ?? undefined) as Record<string, number> | undefined },
        submitted,
        nowMs
      )
    : { avgChangePct: 0, direction: 'stable' as const };
  const strengthDrop = strength.direction === 'down' && strength.avgChangePct < 0;
  const strengthDropWithinToleranceCut = phase === 'cut' && strengthDrop && strength.avgChangePct >= -toleranceCut;
  const strengthDropWithinToleranceBulk = phase === 'bulk' && strengthDrop && strength.avgChangePct >= -toleranceBulk;
  const strengthDropBeyondTolerance = strengthDrop && (phase === 'cut' ? strength.avgChangePct < -toleranceCut : strength.avgChangePct < -toleranceBulk);

  // 1) LOW ENERGY TREND
  if (logCount > 0 && energyAvg < LOW_ENERGY_THRESHOLD) {
    signals.push(`Low energy trend (7d avg ${energyAvg.toFixed(1)})`);
    fatigueScore += 35;
  }
  const sortedByDate = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  let consecutiveLow = 0;
  for (let i = sortedByDate.length - 1; i >= 0; i--) {
    if (sortedByDate[i].energy <= SEVERE_ENERGY_MAX) consecutiveLow++;
    else break;
  }
  if (consecutiveLow >= SEVERE_CONSECUTIVE) {
    signals.push(`${SEVERE_CONSECUTIVE} consecutive days energy ≤ ${SEVERE_ENERGY_MAX}`);
    fatigueScore += 40;
  }

  // 2) ENERGY + STRENGTH DROP CORRELATION
  if (strengthDropBeyondTolerance && logCount > 0 && energyAvg < ENERGY_STRENGTH_CORR_THRESHOLD) {
    signals.push('Strength drop likely fatigue-driven');
    strengthExplainedByFatigue = true;
    fatigueScore += 25;
  }

  // 3) CUT PHASE SUPPRESSION — within tolerance + decent energy => do NOT flag as risk
  if (phase === 'cut' && strengthDrop && strengthDropWithinToleranceCut && energyAvg >= ENERGY_STRENGTH_CORR_THRESHOLD) {
    expectedCutSuppression = true;
    signals.push('Expected cut suppression (strength within tolerance)');
    // Don't add to fatigueScore; this is informational.
  }

  // 4) BULK PHASE WARNING — strength drop beyond tolerance but energy ok => performance concern (non-fatigue)
  if (phase === 'bulk' && strengthDropBeyondTolerance && energyAvg >= ENERGY_STRENGTH_CORR_THRESHOLD) {
    bulkPerformanceConcern = true;
    signals.push('Performance concern (strength drop in bulk despite decent energy)');
    fatigueScore += 10;
  }

  // 5) SLEEP CORRELATION
  if (sleepAvg != null && sleepAvg < SLEEP_LOW_H && logCount > 0 && energyAvg < ENERGY_STRENGTH_CORR_THRESHOLD) {
    signals.push('Recovery likely sleep-related');
    fatigueScore += 20;
  }

  fatigueScore = Math.min(100, fatigueScore);

  let fatigueLevel: FatigueLevel = 'LOW';
  if (fatigueScore >= 50 || consecutiveLow >= SEVERE_CONSECUTIVE) fatigueLevel = 'HIGH';
  else if (fatigueScore >= 25 || (logCount > 0 && energyAvg < LOW_ENERGY_THRESHOLD)) fatigueLevel = 'MODERATE';

  return {
    fatigueLevel,
    signals,
    fatigueScore,
    strengthExplainedByFatigue: strengthExplainedByFatigue || undefined,
    expectedCutSuppression: expectedCutSuppression || undefined,
    bulkPerformanceConcern: bulkPerformanceConcern || undefined,
  };
}
