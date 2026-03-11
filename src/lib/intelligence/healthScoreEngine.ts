/**
 * Phase-Aware Client Health Score Engine.
 * Strict, logic-based scoring (no AI). Adapts by client phase: offseason, prep, peak.
 */

export type Phase = 'offseason' | 'prep' | 'peak';

export type RiskLevel = 'low' | 'moderate' | 'high';

export interface HealthScoreInput {
  phase: Phase;
  /** kg change over 7 days */
  weightTrend: number;
  /** percent change (e.g. -5 = 5% drop) */
  strengthTrend: number;
  /** 0–100 */
  stepsCompliance: number;
  /** 0–100 */
  cardioCompliance: number;
  /** 0–100 */
  adherence: number;
  /** hours */
  sleepAvg: number;
  /** 1–5 */
  mood: number;
  /** days out from target (e.g. show); null if N/A */
  daysOut: number | null;
  /** Future: set true to trigger sodium deviation red flag (peak) */
  sodiumDeviation?: boolean;
}

export interface HealthScoreResult {
  score: number;
  risk: RiskLevel;
  flags: string[];
  summary: string;
}

const SCORE_MIN = 0;
const SCORE_MAX = 100;
const RISK_LOW_THRESHOLD = 75;
const RISK_MODERATE_THRESHOLD = 50;

function clamp(score: number): number {
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, Math.round(score)));
}

function riskFromScore(score: number): RiskLevel {
  if (score >= RISK_LOW_THRESHOLD) return 'low';
  if (score >= RISK_MODERATE_THRESHOLD) return 'moderate';
  return 'high';
}

/** Offseason: weight drop hurts; strength drop >5% red; steps/cardio less weighted */
function applyOffseason(
  input: HealthScoreInput
): { deduction: number; flags: string[] } {
  let deduction = 0;
  const flags: string[] = [];

  if (input.weightTrend < 0) {
    const d = Math.min(15, Math.abs(input.weightTrend) * 12);
    deduction += d;
    flags.push(`Weight trend down ${input.weightTrend.toFixed(1)} kg (7d)`);
  }

  if (input.strengthTrend < -5) {
    deduction += 15;
    flags.push(`Strength drop ${Math.abs(input.strengthTrend).toFixed(1)}% exceeds 5% threshold`);
  }

  if (input.stepsCompliance < 80) {
    deduction += input.stepsCompliance < 60 ? 8 : 4;
    if (input.stepsCompliance < 60) flags.push('Steps compliance below 60%');
  }

  if (input.cardioCompliance < 80) {
    deduction += input.cardioCompliance < 60 ? 5 : 2;
  }

  if (input.adherence < 70) {
    deduction += input.adherence < 50 ? 10 : 5;
    if (input.adherence < 50) flags.push('Adherence below 50%');
  }

  if (input.sleepAvg < 6) {
    deduction += 5;
    flags.push('Sleep average below 6 hours');
  }

  if (input.mood < 3) {
    deduction += 5;
    flags.push('Mood below 3');
  }

  return { deduction, flags };
}

/** Prep: weight spike >0.5 red; cardio <90% red; steps <90% amber; strength >10% red; daysOut <21 increases sensitivity */
function applyPrep(input: HealthScoreInput): { deduction: number; flags: string[] } {
  let deduction = 0;
  const flags: string[] = [];
  const nearShow = input.daysOut !== null && input.daysOut < 21;

  if (input.weightTrend > 0.5) {
    deduction += nearShow ? 25 : 18;
    flags.push(`Weight spike +${input.weightTrend.toFixed(1)} kg (7d) exceeds 0.5 kg`);
  }

  if (input.cardioCompliance < 90) {
    deduction += 16;
    flags.push('Cardio compliance below 90%');
  }

  if (input.stepsCompliance < 90) {
    deduction += 8;
    flags.push('Steps compliance below 90%');
  }

  if (input.strengthTrend < -10) {
    deduction += 14;
    flags.push(`Strength drop ${Math.abs(input.strengthTrend).toFixed(1)}% exceeds 10%`);
  }

  if (input.adherence < 80) {
    deduction += input.adherence < 60 ? 12 : 6;
    if (input.adherence < 60) flags.push('Adherence below 60%');
  }

  if (input.sleepAvg < 6) {
    deduction += 6;
    flags.push('Sleep average below 6 hours');
  }

  if (input.mood < 3) {
    deduction += 5;
    flags.push('Mood below 3');
  }

  return { deduction, flags };
}

/** Peak: any cardio miss = red; sodium deviation = red; weight volatility >0.3 kg = high risk */
function applyPeak(input: HealthScoreInput): { deduction: number; flags: string[]; forceHighRisk?: boolean } {
  let deduction = 0;
  const flags: string[] = [];
  let forceHighRisk = false;

  if (input.cardioCompliance < 100) {
    deduction += 22;
    flags.push('Cardio not fully completed');
  }

  if (input.sodiumDeviation === true) {
    deduction += 18;
    flags.push('Sodium deviation from plan');
  }

  const weightVolatility = Math.abs(input.weightTrend);
  if (weightVolatility > 0.3) {
    deduction += 20;
    forceHighRisk = true;
    flags.push(`Weight volatility ${weightVolatility.toFixed(1)} kg exceeds 0.3 kg`);
  }

  if (input.stepsCompliance < 95) {
    deduction += 10;
    flags.push('Steps compliance below 95%');
  }

  if (input.adherence < 90) {
    deduction += input.adherence < 70 ? 15 : 8;
    if (input.adherence < 70) flags.push('Adherence below 70%');
  }

  if (input.sleepAvg < 6) {
    deduction += 8;
    flags.push('Sleep average below 6 hours');
  }

  if (input.mood < 3) {
    deduction += 6;
    flags.push('Mood below 3');
  }

  return { deduction, flags, forceHighRisk };
}

function buildSummary(
  phase: Phase,
  score: number,
  risk: RiskLevel,
  flags: string[]
): string {
  const riskLine =
    risk === 'high'
      ? 'Risk is high.'
      : risk === 'moderate'
        ? 'Risk is moderate.'
        : 'Risk is low.';

  if (phase === 'prep') {
    if (flags.length === 0) {
      return `Score ${score}. ${riskLine} All prep metrics within tolerance. Maintain current discipline.`;
    }
    return `Score ${score}. ${riskLine} Address: ${flags.slice(0, 3).join('; ')}${flags.length > 3 ? '.' : ''}`;
  }

  if (phase === 'offseason') {
    if (flags.length === 0) {
      return `Score ${score}. ${riskLine} Trends and compliance are within acceptable ranges for offseason.`;
    }
    const factors = flags.slice(0, 3).join('; ');
    return `Score ${score}. ${riskLine} Notable factors: ${factors}. Review data before next block.`;
  }

  if (phase === 'peak') {
    if (flags.length === 0) {
      return `Score ${score}. ${riskLine} Peak metrics on target.`;
    }
    return `Score ${score}. ${riskLine} Deviations: ${flags.slice(0, 3).join('; ')}.`;
  }

  return `Score ${score}. ${riskLine}`;
}

/**
 * Computes phase-aware health score from client metrics.
 * Starts at 100, applies weighted deductions by phase, clamps to 0–100.
 */
export function calculateHealthScore(input: HealthScoreInput): HealthScoreResult {
  let deduction = 0;
  let flags: string[] = [];
  let forceHighRisk = false;

  switch (input.phase) {
    case 'offseason':
      ({ deduction, flags } = applyOffseason(input));
      break;
    case 'prep':
      ({ deduction, flags } = applyPrep(input));
      break;
    case 'peak': {
      const out = applyPeak(input);
      deduction = out.deduction;
      flags = out.flags;
      forceHighRisk = out.forceHighRisk ?? false;
      break;
    }
  }

  const rawScore = SCORE_MAX - deduction;
  const score = clamp(rawScore);
  const risk = forceHighRisk ? 'high' : riskFromScore(score);
  const summary = buildSummary(input.phase, score, risk, flags);

  return { score, risk, flags, summary };
}
