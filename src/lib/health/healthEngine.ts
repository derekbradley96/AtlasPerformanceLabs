/**
 * Deterministic Client Health Engine.
 * Single source of truth: score 0-100, riskLevel (green|amber|red), reasons, actions, flags.
 * All logic centralized; screens only render engine output.
 * Safe: no throws on missing/null inputs.
 */

export type RiskLevel = 'green' | 'amber' | 'red';

export type PhaseBand = 'early_prep' | 'mid_prep' | 'late_prep' | 'peak_week' | null;

export interface DerivePhaseResult {
  phase: PhaseBand;
  daysOutBand: string;
  sensitivity: number;
}

export interface HealthEngineResult {
  score: number;
  riskLevel: RiskLevel;
  bandLabel: string;
  reasons: string[];
  actions: string[];
  flags: string[];
  meta: {
    phase: PhaseBand;
    daysOut: number | null;
    sensitivity: number;
    breakdown: { compliance: number; trend: number; recovery: number; comms: number };
  };
}

/** Client-like: optional fields only. */
export interface ClientInput {
  id?: string | null;
  name?: string | null;
  full_name?: string | null;
  goal?: string | null;
  phase?: string | null;
  show_date?: string | null;
  showDate?: string | null;
  steps_target?: number | null;
  stepsTarget?: number | null;
  cardio_target_mins?: number | null;
  cardioTargetMins?: number | null;
  last_check_in_at?: string | null;
  [key: string]: unknown;
}

/** Latest check-in like. */
export interface LatestCheckInInput {
  created_at?: string | null;
  created_date?: string | null;
  due_date?: string | null;
  submitted_at?: string | null;
  weight_kg?: number | null;
  adherence_pct?: number | null;
  steps?: number | null;
  steps_avg?: number | null;
  cardio_done_mins?: number | null;
  sleep_avg?: number | null;
  sleep_hours?: number | null;
  digestion_flags?: string[] | null;
  mood?: number | null;
  stress?: number | null;
  status?: string | null;
  metrics?: Record<string, number> | null;
  [key: string]: unknown;
}

/** Message summary for comms. */
export interface MessageSummaryInput {
  unreadCount?: number | null;
}

/** Recent weights for trend. */
export interface RecentWeightInput {
  occurred_at?: string | null;
  weight_kg?: number | null;
}

export interface HealthContext {
  latestCheckIn?: LatestCheckInInput | null;
  messageSummary?: MessageSummaryInput | null;
  recentWeights?: RecentWeightInput[] | null;
  /** All check-ins for this client (for overdue / missing). */
  checkIns?: LatestCheckInInput[] | null;
}

// --- Helpers (must not throw) ---

export function safeNumber(value: unknown, fallback: number): number {
  if (value == null) return fallback;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function safeDate(input: unknown): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  const d = new Date(input as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

/** Days until show; null if no show or past. */
function daysOutFromClient(client: ClientInput): number | null {
  const show = client?.show_date ?? client?.showDate ?? null;
  if (!show) return null;
  const d = safeDate(show);
  if (!d) return null;
  const now = Date.now();
  const days = Math.ceil((d.getTime() - now) / (24 * 60 * 60 * 1000));
  return days >= 0 ? days : null;
}

// --- derivePhase ---

/**
 * Phase from isCompPrep + daysOut.
 * Bands: >70 early_prep, 70-28 mid_prep, 27-8 late_prep, 7-0 peak_week.
 * Sensitivity: early 1.0, mid 1.2, late 1.5, peak 2.0.
 */
export function derivePhase(params: {
  isCompPrep?: boolean | null;
  daysOut?: number | null;
}): DerivePhaseResult {
  const isCompPrep = params?.isCompPrep === true;
  const daysOut = params?.daysOut != null && Number.isFinite(params.daysOut) ? params.daysOut : null;

  if (!isCompPrep || daysOut == null || daysOut < 0) {
    return { phase: null, daysOutBand: '', sensitivity: 1.0 };
  }

  if (daysOut <= 7) {
    return { phase: 'peak_week', daysOutBand: 'peak_week', sensitivity: 2.0 };
  }
  if (daysOut <= 27) {
    return { phase: 'late_prep', daysOutBand: 'late_prep', sensitivity: 1.5 };
  }
  if (daysOut <= 70) {
    return { phase: 'mid_prep', daysOutBand: 'mid_prep', sensitivity: 1.2 };
  }
  return { phase: 'early_prep', daysOutBand: 'early_prep', sensitivity: 1.0 };
}

// --- Constants ---

const MAX_REASONS = 4;
const MAX_ACTIONS = 3;
const FLAGS = {
  CHECKIN_OVERDUE: 'CHECKIN_OVERDUE',
  WEIGHT_SPIKE: 'WEIGHT_SPIKE',
  LOW_ADHERENCE: 'LOW_ADHERENCE',
  LOW_STEPS: 'LOW_STEPS',
  LOW_CARDIO: 'LOW_CARDIO',
  DIGESTION_ISSUE: 'DIGESTION_ISSUE',
  RECOVERY_RISK: 'RECOVERY_RISK',
  UNREAD_MESSAGES: 'UNREAD_MESSAGES',
  MISSING_CHECKIN: 'MISSING_CHECKIN',
} as const;

const RISK_THRESHOLD_GREEN = 75;
const RISK_THRESHOLD_AMBER = 50;

function riskLevelFromScore(score: number): RiskLevel {
  if (score >= RISK_THRESHOLD_GREEN) return 'green';
  if (score >= RISK_THRESHOLD_AMBER) return 'amber';
  return 'red';
}

function bandLabelFromRisk(risk: RiskLevel): string {
  if (risk === 'green') return 'On track';
  if (risk === 'amber') return 'Monitor';
  return 'At risk';
}

// --- Scoring buckets (start 100, subtract penalties; each bucket has a cap) ---

const BUCKET_COMPLIANCE = 40;
const BUCKET_TREND = 25;
const BUCKET_RECOVERY = 20;
const BUCKET_COMMS = 15;

/**
 * Evaluate client health. Never throws; missing inputs yield safe defaults.
 */
export function evaluateClientHealth(
  client: ClientInput | null | undefined,
  context: HealthContext = {}
): HealthEngineResult {
  const safeClient = client ?? {};
  const latestCheckIn = context?.latestCheckIn ?? null;
  const messageSummary = context?.messageSummary ?? null;
  const recentWeights = safeArray<RecentWeightInput>(context?.recentWeights);
  const checkIns = safeArray<LatestCheckInInput>(context?.checkIns);

  const daysOut = daysOutFromClient(safeClient);
  const isCompPrep =
    Boolean(safeClient.show_date ?? safeClient.showDate) ||
    String(safeClient.phase ?? '').toLowerCase().includes('prep') ||
    String(safeClient.phase ?? '').toLowerCase().includes('peak');
  const { phase, sensitivity } = derivePhase({ isCompPrep, daysOut });

  let penaltyCompliance = 0;
  let penaltyTrend = 0;
  let penaltyRecovery = 0;
  let penaltyComms = 0;
  const flags: string[] = [];
  const reasonCandidates: Array<{ text: string; severity: number }> = [];

  // --- Compliance (40): overdue, adherence, steps, cardio ---
  const now = Date.now();
  const hasPending = checkIns.some(
    (c) => (c?.status ?? '').toLowerCase() === 'pending'
  );
  const anyOverdue = hasPending && checkIns.some((c) => {
    if ((c?.status ?? '').toLowerCase() !== 'pending') return false;
    const due = safeDate(c?.due_date ?? c?.created_date);
    return due != null && due.getTime() < now;
  });
  if (anyOverdue) {
    const p = Math.min(20, 15 * sensitivity);
    penaltyCompliance += p;
    flags.push(FLAGS.CHECKIN_OVERDUE);
    reasonCandidates.push({ text: 'Check-in overdue', severity: 10 });
  }

  const adherence = safeNumber(
    latestCheckIn?.adherence_pct ?? latestCheckIn?.metrics?.adherence,
    100
  );
  if (adherence < 80) {
    const p = adherence < 50 ? 15 : adherence < 70 ? 10 : 5;
    penaltyCompliance += Math.min(p * sensitivity, BUCKET_COMPLIANCE - penaltyCompliance);
    flags.push(FLAGS.LOW_ADHERENCE);
    reasonCandidates.push({
      text: adherence < 50 ? 'Adherence below 50%' : 'Adherence below target',
      severity: 8,
    });
  }

  const stepsTarget = safeNumber(
    safeClient.steps_target ?? safeClient.stepsTarget,
    10000
  );
  const stepsActual = safeNumber(
    latestCheckIn?.steps ?? latestCheckIn?.steps_avg ?? latestCheckIn?.metrics?.steps,
    0
  );
  if (stepsTarget > 0 && stepsActual < stepsTarget * 0.7) {
    penaltyCompliance += Math.min(8 * sensitivity, BUCKET_COMPLIANCE - penaltyCompliance);
    flags.push(FLAGS.LOW_STEPS);
    reasonCandidates.push({ text: 'Steps below target', severity: 5 });
  }

  const cardioTarget = safeNumber(
    safeClient.cardio_target_mins ?? safeClient.cardioTargetMins,
    0
  );
  const cardioDone = safeNumber(
    latestCheckIn?.cardio_done_mins ?? latestCheckIn?.metrics?.cardio_mins,
    0
  );
  if (cardioTarget > 0 && cardioDone < cardioTarget * 0.7) {
    penaltyCompliance += Math.min(8 * sensitivity, BUCKET_COMPLIANCE - penaltyCompliance);
    flags.push(FLAGS.LOW_CARDIO);
    reasonCandidates.push({ text: 'Cardio below target', severity: 5 });
  }

  // No recent submitted check-in at all
  const hasSubmitted = checkIns.some(
    (c) => (c?.status ?? '').toLowerCase() === 'submitted'
  );
  if (!hasSubmitted && checkIns.length > 0) {
    penaltyCompliance += Math.min(10, 10 * sensitivity);
    flags.push(FLAGS.MISSING_CHECKIN);
    reasonCandidates.push({ text: 'No recent check-in submitted', severity: 7 });
  }

  penaltyCompliance = Math.min(penaltyCompliance, BUCKET_COMPLIANCE);

  // --- Trend (25): weight delta, volatility ---
  if (recentWeights.length >= 2) {
    const sorted = [...recentWeights].sort((a, b) => {
      const ta = safeDate(a?.occurred_at)?.getTime() ?? 0;
      const tb = safeDate(b?.occurred_at)?.getTime() ?? 0;
      return tb - ta;
    });
    const latest = safeNumber(sorted[0]?.weight_kg, 0);
    const prev = safeNumber(sorted[1]?.weight_kg, 0);
    if (Number.isFinite(latest) && Number.isFinite(prev)) {
      const delta = latest - prev;
      const spike = sensitivity >= 1.5 ? 0.5 : 1.0;
      if (delta > spike) {
        penaltyTrend += Math.min(20 * sensitivity, BUCKET_TREND);
        flags.push(FLAGS.WEIGHT_SPIKE);
        reasonCandidates.push({
          text: `Weight up +${delta.toFixed(1)} kg vs last reading`,
          severity: 9,
        });
      }
    }
  }
  const weightKg = safeNumber(latestCheckIn?.weight_kg, 0);
  if (weightKg <= 0 && recentWeights.length === 0 && hasSubmitted) {
    // No weight logged in submitted check-in
    penaltyTrend += Math.min(5, 5 * sensitivity);
  }
  penaltyTrend = Math.min(penaltyTrend, BUCKET_TREND);

  // --- Recovery (20): sleep, mood, stress, digestion ---
  const sleepAvg =
    safeNumber(latestCheckIn?.sleep_avg ?? latestCheckIn?.sleep_hours ?? latestCheckIn?.metrics?.sleep, 7);
  const mood = safeNumber(
    latestCheckIn?.mood ?? latestCheckIn?.metrics?.mood ?? latestCheckIn?.metrics?.energy,
    4
  );
  const stress = safeNumber(
    latestCheckIn?.stress ?? latestCheckIn?.metrics?.stress,
    2
  );
  const digestionFlags = safeArray<string>(latestCheckIn?.digestion_flags);

  if (sleepAvg < 6) {
    penaltyRecovery += 6;
    flags.push(FLAGS.RECOVERY_RISK);
    reasonCandidates.push({ text: 'Sleep below 6 hours', severity: 6 });
  }
  if (mood < 3) {
    penaltyRecovery += 5;
    if (!flags.includes(FLAGS.RECOVERY_RISK)) flags.push(FLAGS.RECOVERY_RISK);
    reasonCandidates.push({ text: 'Low mood', severity: 5 });
  }
  if (stress >= 4) {
    penaltyRecovery += 4;
    if (!flags.includes(FLAGS.RECOVERY_RISK)) flags.push(FLAGS.RECOVERY_RISK);
    reasonCandidates.push({ text: 'High stress', severity: 4 });
  }
  if (digestionFlags.length > 0) {
    penaltyRecovery += Math.min(8 * sensitivity, 8);
    flags.push(FLAGS.DIGESTION_ISSUE);
    reasonCandidates.push({ text: 'Digestion issues noted', severity: 7 });
  }
  penaltyRecovery = Math.min(penaltyRecovery, BUCKET_RECOVERY);

  // --- Comms (15): unread, missed updates ---
  const unreadCount = safeNumber(messageSummary?.unreadCount, 0);
  if (unreadCount > 5) {
    penaltyComms += Math.min(8, unreadCount);
    flags.push(FLAGS.UNREAD_MESSAGES);
    reasonCandidates.push({ text: 'Unread messages', severity: 3 });
  } else if (unreadCount > 0) {
    penaltyComms += Math.min(4, unreadCount);
  }
  penaltyComms = Math.min(penaltyComms, BUCKET_COMMS);

  // --- Total score ---
  const totalPenalty = penaltyCompliance + penaltyTrend + penaltyRecovery + penaltyComms;
  const score = Math.max(0, Math.min(100, Math.round(100 - totalPenalty)));
  const riskLevel = riskLevelFromScore(score);
  const bandLabel = bandLabelFromRisk(riskLevel);

  // --- Reasons (max 4, by severity) ---
  reasonCandidates.sort((a, b) => b.severity - a.severity);
  const reasons = reasonCandidates.slice(0, MAX_REASONS).map((r) => r.text);

  // --- Actions (max 3, prep tone) ---
  const actions: string[] = [];
  if (flags.includes(FLAGS.CHECKIN_OVERDUE)) {
    actions.push('Get check-in submitted today.');
  }
  if (flags.includes(FLAGS.LOW_ADHERENCE)) {
    actions.push('Review program adherence and adjust if needed.');
  }
  if (flags.includes(FLAGS.WEIGHT_SPIKE)) {
    actions.push('Check nutrition and water; keep to plan.');
  }
  if (flags.includes(FLAGS.DIGESTION_ISSUE)) {
    actions.push('Note digestion in next check-in and adjust if needed.');
  }
  if (flags.includes(FLAGS.RECOVERY_RISK)) {
    actions.push('Prioritise sleep and recovery.');
  }
  if (flags.includes(FLAGS.UNREAD_MESSAGES)) {
    actions.push('Reply to messages when you can.');
  }
  if (actions.length === 0 && score < 100) {
    actions.push('Keep current habits; no change needed.');
  }

  return {
    score,
    riskLevel,
    bandLabel,
    reasons,
    actions: actions.slice(0, MAX_ACTIONS),
    flags: [...new Set(flags)],
    meta: {
      phase,
      daysOut,
      sensitivity,
      breakdown: {
        compliance: Math.max(0, BUCKET_COMPLIANCE - penaltyCompliance),
        trend: Math.max(0, BUCKET_TREND - penaltyTrend),
        recovery: Math.max(0, BUCKET_RECOVERY - penaltyRecovery),
        comms: Math.max(0, BUCKET_COMMS - penaltyComms),
      },
    },
  };
}