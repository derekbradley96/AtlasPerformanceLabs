/**
 * Personal in-workout copy: Basic = fast, quiet; Enhanced = optional nudges without blocking flow.
 * No coach/client jargon.
 */

import { formatTrainingLoadKg } from '@/lib/trainingLoadUnits';

/**
 * @param {{ setNumber: number, reps?: number|null, weightKg?: number|null, weight?: number|null, loadUnit?: string | null }} p
 * `weight` is deprecated; prefer `weightKg` (canonical kg from history).
 */
export function personalLastTimeLine({ setNumber, reps, weightKg, weight, loadUnit }) {
  const wKg = weightKg != null ? weightKg : weight;
  if (reps == null && wKg == null) return null;
  const parts = [`Last time (set ${setNumber})`];
  if (reps != null) parts.push(`${reps} reps`);
  if (wKg != null) parts.push(formatTrainingLoadKg(wKg, loadUnit ?? 'kg'));
  return parts.join(' · ');
}

/** @param {{ repsNow: number, prevReps: number|null|undefined }} p */
export function personalSetProgressionFeedback({ repsNow, prevReps }) {
  if (prevReps == null || !Number.isFinite(prevReps)) return null;
  const diff = repsNow - prevReps;
  if (diff === 0) return 'Matched last session';
  if (diff > 0) return `+${diff} reps vs last time`;
  return `${diff} reps vs last time`;
}

export function personalPlaySetHint(basic) {
  return basic
    ? 'Enter weight and reps, then tap the check to log this set.'
    : 'Adjust weight or reps if needed, then tap the check — suggestions are optional.';
}

export function personalRestCompleteToastEnhanced() {
  return 'Rest done — next set when you’re ready';
}

export function personalEditPlanCta() {
  return 'Edit plan';
}

export function personalNoSessionBody() {
  return 'Add training days in your plan to use the guided session.';
}

export function personalFatigueHintEnhanced(readinessScore) {
  const n = Number(readinessScore);
  if (!Number.isFinite(n)) return null;
  if (n <= 4) return 'Readiness is low today — favor crisp reps over chasing numbers.';
  if (n <= 6) return 'Moderate energy — match last week before pushing load.';
  return null;
}

export function personalProgressionNudgeEnhanced({ prevReps }) {
  if (prevReps == null || !Number.isFinite(prevReps) || prevReps < 1) return null;
  return `You hit ${prevReps} reps here last time — add a rep or a small load when it feels right.`;
}
