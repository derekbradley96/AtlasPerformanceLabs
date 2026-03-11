/**
 * Phase-aware At Risk flags. Deterministic rules (no AI).
 * Returns flags with id, severity ('low'|'moderate'|'high'), title, details, action.
 */
export type AtRiskPhase = 'bulk' | 'offseason' | 'cut' | 'prep' | 'peak';
export type AtRiskSeverity = 'low' | 'moderate' | 'high';

export interface AtRiskFlag {
  id: string;
  severity: AtRiskSeverity;
  title: string;
  details: string;
  action: string;
}

export interface EvaluateAtRiskInput {
  phase: AtRiskPhase;
  daysOut: number | null;
  weightTrend7d: number;
  weightDeltaToday: number;
  strengthTrend: number;
  stepsCompliance: number;
  cardioCompliance: number;
  adherence: number;
  sleepAvg: number;
  mood: number;
  /** Peak: missed cardio today */
  missedCardioToday?: boolean;
  /** Peak: missed steps today */
  missedStepsToday?: boolean;
}

const SEVERITY_ORDER: AtRiskSeverity[] = ['high', 'moderate', 'low'];

function dedupeBySeverity(flags: AtRiskFlag[]): AtRiskFlag[] {
  const byId = new Map<string, AtRiskFlag>();
  for (const f of flags) {
    const existing = byId.get(f.id);
    if (!existing || SEVERITY_ORDER.indexOf(f.severity) < SEVERITY_ORDER.indexOf(existing.severity)) {
      byId.set(f.id, f);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );
}

function bulkOffseasonFlags(input: EvaluateAtRiskInput): AtRiskFlag[] {
  const flags: AtRiskFlag[] = [];
  if (input.weightTrend7d <= -0.4) {
    flags.push({
      id: 'weight_down_bulk',
      severity: 'moderate',
      title: 'Unexpected weight loss',
      details: `${input.weightTrend7d.toFixed(1)} kg over 7 days`,
      action: 'Review nutrition and recovery.',
    });
  }
  if (input.strengthTrend <= -5) {
    flags.push({
      id: 'strength_down_bulk',
      severity: 'high',
      title: 'Strength drop',
      details: `${Math.abs(input.strengthTrend).toFixed(1)}% vs baseline`,
      action: 'Check recovery and load progression.',
    });
  }
  return flags;
}

function cutFlags(input: EvaluateAtRiskInput): AtRiskFlag[] {
  const flags: AtRiskFlag[] = [];
  const weightUp7d = input.weightTrend7d >= 0.3;
  const weightUpToday = input.weightDeltaToday >= 0.4;
  if (weightUp7d || weightUpToday) {
    flags.push({
      id: 'weight_up_cut',
      severity: 'high',
      title: 'Weight trending up',
      details: weightUpToday
        ? `+${input.weightDeltaToday.toFixed(1)} kg today`
        : `+${input.weightTrend7d.toFixed(1)} kg over 7 days`,
      action: 'Tighten nutrition and check adherence.',
    });
  }
  if (input.adherence < 80) {
    const severity: AtRiskSeverity = input.adherence < 70 ? 'high' : 'moderate';
    flags.push({
      id: 'adherence_cut',
      severity,
      title: 'Adherence below target',
      details: `${input.adherence}%`,
      action: 'Address barriers to consistency.',
    });
  }
  return flags;
}

function prepFlags(input: EvaluateAtRiskInput): AtRiskFlag[] {
  const flags: AtRiskFlag[] = [];
  const nearShow = input.daysOut !== null && input.daysOut < 21;
  const veryNear = input.daysOut !== null && input.daysOut < 14;

  if (input.cardioCompliance < 90) {
    flags.push({
      id: 'cardio_prep',
      severity: nearShow ? 'high' : 'high',
      title: 'Cardio compliance low',
      details: `${input.cardioCompliance}%`,
      action: 'Complete all cardio sessions.',
    });
  }
  if (input.stepsCompliance < 90) {
    flags.push({
      id: 'steps_prep',
      severity: veryNear ? 'high' : 'moderate',
      title: 'Steps compliance low',
      details: `${input.stepsCompliance}%`,
      action: 'Hit daily step target.',
    });
  }
  if (input.strengthTrend <= -10) {
    const alsoLow = input.adherence < 80 || input.cardioCompliance < 90;
    flags.push({
      id: 'strength_prep',
      severity: alsoLow ? 'high' : 'moderate',
      title: 'Strength drop in prep',
      details: `${Math.abs(input.strengthTrend).toFixed(1)}%`,
      action: 'Expected in deficit; monitor if paired with other misses.',
    });
  }
  return flags;
}

function peakFlags(input: EvaluateAtRiskInput): AtRiskFlag[] {
  const flags: AtRiskFlag[] = [];
  if (input.missedCardioToday) {
    flags.push({
      id: 'cardio_missed_peak',
      severity: 'high',
      title: 'Cardio missed today',
      details: 'Session not completed',
      action: 'Complete or document reason.',
    });
  }
  if (input.missedStepsToday) {
    flags.push({
      id: 'steps_missed_peak',
      severity: 'high',
      title: 'Steps missed today',
      details: 'Below target',
      action: 'Hit step target before show.',
    });
  }
  const dayToDayVolatility = Math.abs(input.weightDeltaToday);
  if (dayToDayVolatility > 0.3) {
    flags.push({
      id: 'weight_volatility_peak',
      severity: 'high',
      title: 'Weight volatility',
      details: `${dayToDayVolatility.toFixed(1)} kg day-to-day`,
      action: 'Stabilize sodium and water.',
    });
  }
  return flags;
}

/**
 * Phase-aware at-risk evaluation.
 * Returns { flags } with stable, deterministic flags.
 * Safeguards: defaults numbers to 0, phase to 'offseason', daysOut to null.
 */
export function evaluateAtRisk(input: EvaluateAtRiskInput | null | undefined): { flags: AtRiskFlag[] } {
  if (input == null) return { flags: [] };
  const phase = input.phase ?? 'offseason';
  const safe: EvaluateAtRiskInput = {
    phase: phase as AtRiskPhase,
    daysOut: input.daysOut ?? null,
    weightTrend7d: typeof input.weightTrend7d === 'number' ? input.weightTrend7d : 0,
    weightDeltaToday: typeof input.weightDeltaToday === 'number' ? input.weightDeltaToday : 0,
    strengthTrend: typeof input.strengthTrend === 'number' ? input.strengthTrend : 0,
    stepsCompliance: typeof input.stepsCompliance === 'number' ? input.stepsCompliance : 100,
    cardioCompliance: typeof input.cardioCompliance === 'number' ? input.cardioCompliance : 100,
    adherence: typeof input.adherence === 'number' ? input.adherence : 100,
    sleepAvg: typeof input.sleepAvg === 'number' ? input.sleepAvg : 7,
    mood: typeof input.mood === 'number' ? input.mood : 4,
    missedCardioToday: input.missedCardioToday ?? false,
    missedStepsToday: input.missedStepsToday ?? false,
  };
  const flags: AtRiskFlag[] = [];

  if (phase === 'bulk' || phase === 'offseason') {
    flags.push(...bulkOffseasonFlags(safe));
  } else if (phase === 'cut') {
    flags.push(...cutFlags(safe));
  } else if (phase === 'prep') {
    flags.push(...prepFlags(safe));
  } else if (phase === 'peak') {
    flags.push(...peakFlags(safe));
  }

  return { flags: dedupeBySeverity(flags) };
}
