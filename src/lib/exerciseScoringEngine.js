import { normalizeMovementPattern, normalizeMuscle, normalizeEquipmentPrimary } from '@/lib/exerciseTaxonomy';

const WEIGHTS = {
  goalFit: 20,
  movementFit: 12,
  muscleFit: 12,
  fatigueFit: 8,
  skillFit: 8,
  equipmentFit: 14,
  bodyConstraintsFit: 8,
  phaseFit: 6,
  sessionPlacementFit: 6,
  historyFit: 6,
};

function asArray(v) {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x || '').trim()).filter(Boolean);
}

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(n) || 0));
}

function scoreScaled(base, weight) {
  return Math.round(clamp(base, 0, 1) * weight);
}

function goalScore(exercise, context) {
  const goal = String(context?.goal || '').toLowerCase().trim();
  const goals = asArray(exercise?.best_for_goals).map((g) => g.toLowerCase());
  if (!goal) return 0.6;
  if (goals.includes(goal)) return 1;
  if (goal === 'muscle' && (goals.includes('hypertrophy') || goals.includes('muscle_gain'))) return 0.95;
  if (goal === 'competition' && (goals.includes('strength') || goals.includes('competition_prep'))) return 0.9;
  if (goal === 'fat_loss' && (goals.includes('general_fitness') || goals.includes('endurance'))) return 0.75;
  return 0.35;
}

function movementScore(exercise, context) {
  const desired = normalizeMovementPattern(context?.slot?.movementPattern || context?.movementPattern);
  if (!desired) return 0.6;
  const actual = normalizeMovementPattern(exercise?.movement_pattern);
  if (!actual) return 0.3;
  return actual === desired ? 1 : 0.25;
}

function muscleScore(exercise, context) {
  const targets = asArray(context?.slot?.targetMuscles || context?.focusMuscles || context?.focusAreas)
    .map((m) => normalizeMuscle(m))
    .filter(Boolean);
  if (!targets.length) return 0.6;
  const primary = normalizeMuscle(exercise?.primary_muscle);
  const secondary = asArray(exercise?.secondary_muscles).map((m) => normalizeMuscle(m)).filter(Boolean);
  if (primary && targets.includes(primary)) return 1;
  if (secondary.some((m) => targets.includes(m))) return 0.7;
  return 0.2;
}

function fatigueScore(exercise, context) {
  const fatigue = String(exercise?.fatigue_cost || '').toLowerCase();
  const preference = String(context?.fatiguePreference || context?.slot?.fatiguePreference || '').toLowerCase();
  if (!preference) return 0.6;
  if (preference === 'low' && fatigue === 'low') return 1;
  if (preference === 'low' && fatigue === 'moderate') return 0.7;
  if (preference === 'low' && fatigue === 'high') return 0.2;
  if (preference === 'high' && fatigue === 'high') return 1;
  if (preference === 'high' && fatigue === 'moderate') return 0.75;
  return 0.55;
}

function skillScore(exercise, context) {
  const required = String(exercise?.skill_requirement || '').toLowerCase();
  const experience = String(context?.experienceLevel || context?.experience || 'intermediate').toLowerCase();
  if (!required) return 0.6;
  if (experience === 'advanced') return 1;
  if (experience === 'beginner') {
    if (required === 'low') return 1;
    if (required === 'moderate') return 0.6;
    return 0.2;
  }
  if (required === 'high') return 0.5;
  return 0.85;
}

function equipmentScore(exercise, context) {
  const available = new Set(asArray(context?.equipmentAccess || context?.availableEquipment).map((e) => normalizeEquipmentPrimary(e)));
  if (!available.size) return 0.8;
  const primary = normalizeEquipmentPrimary(exercise?.equipment_primary);
  if (!primary) return 0.25;
  if (available.has(primary)) return 1;
  if (primary === 'bodyweight') return 0.9;
  return 0.1;
}

function bodyConstraintScore(exercise, context) {
  const constraints = new Set(asArray(context?.bodyConstraints).map((c) => c.toLowerCase()));
  const tags = new Set(asArray(exercise?.body_context_tags).map((t) => t.toLowerCase()));
  if (!constraints.size) return 0.6;
  if (constraints.has('injury_friendly')) return tags.has('injury_friendly') ? 1 : 0.4;
  if (constraints.has('beginner_friendly')) return tags.has('beginner_friendly') ? 1 : 0.55;
  return 0.6;
}

function phaseScore(exercise, context) {
  const phase = String(context?.phase || '').toLowerCase().trim();
  const tags = new Set(asArray(exercise?.prep_context_tags).map((t) => t.toLowerCase()));
  if (!phase) return 0.6;
  if (tags.has(phase)) return 1;
  return 0.45;
}

function sessionPlacementScore(exercise, context) {
  const slot = String(context?.slot?.sessionWindow || context?.sessionWindow || '').toLowerCase();
  const windows = asArray(exercise?.best_in_session_window).map((w) => w.toLowerCase());
  if (!slot) return 0.6;
  if (windows.includes(slot)) return 1;
  if (slot === 'main' && asArray(exercise?.program_roles).includes('main_lift')) return 0.9;
  return 0.35;
}

function historyScore(exercise, context) {
  const history = context?.historyByExerciseId || {};
  const row = history?.[exercise?.id] || context?.usageByExerciseId?.[exercise?.id];
  if (!row) return 0.5;
  const count = Number(row.usage_count || row.usageCount || 0);
  const preferred = !!row.favorite;
  if (preferred) return 1;
  if (count >= 8) return 0.9;
  if (count >= 4) return 0.75;
  if (count >= 1) return 0.6;
  return 0.5;
}

export function getExerciseMatchReason(exercise, context = {}) {
  const reasons = [];
  const goal = scoreScaled(goalScore(exercise, context), WEIGHTS.goalFit);
  if (goal >= 16) reasons.push(`strong goal fit for ${context?.goal || 'current objective'}`);
  const equip = scoreScaled(equipmentScore(exercise, context), WEIGHTS.equipmentFit);
  if (equip >= 11) reasons.push('matches available equipment');
  const movement = scoreScaled(movementScore(exercise, context), WEIGHTS.movementFit);
  if (movement >= 9) reasons.push('fits slot movement pattern');
  const fatigue = scoreScaled(fatigueScore(exercise, context), WEIGHTS.fatigueFit);
  if (fatigue >= 6 && String(context?.fatiguePreference || '').toLowerCase() === 'low') {
    reasons.push('prioritises lower-fatigue option');
  }
  return reasons.slice(0, 3).join(', ') || 'balanced fit across current context';
}

export function scoreExerciseForContext(exercise, context = {}) {
  const subScores = {
    goalFit: scoreScaled(goalScore(exercise, context), WEIGHTS.goalFit),
    movementFit: scoreScaled(movementScore(exercise, context), WEIGHTS.movementFit),
    muscleFit: scoreScaled(muscleScore(exercise, context), WEIGHTS.muscleFit),
    fatigueFit: scoreScaled(fatigueScore(exercise, context), WEIGHTS.fatigueFit),
    skillFit: scoreScaled(skillScore(exercise, context), WEIGHTS.skillFit),
    equipmentFit: scoreScaled(equipmentScore(exercise, context), WEIGHTS.equipmentFit),
    bodyConstraintsFit: scoreScaled(bodyConstraintScore(exercise, context), WEIGHTS.bodyConstraintsFit),
    phaseFit: scoreScaled(phaseScore(exercise, context), WEIGHTS.phaseFit),
    sessionPlacementFit: scoreScaled(sessionPlacementScore(exercise, context), WEIGHTS.sessionPlacementFit),
    historyFit: scoreScaled(historyScore(exercise, context), WEIGHTS.historyFit),
  };
  const totalScore = Object.values(subScores).reduce((sum, n) => sum + n, 0);
  return {
    totalScore,
    subScores,
    reasonSummary: getExerciseMatchReason(exercise, context),
  };
}

export function rankExercisesForSlot(exercises = [], slotContext = {}) {
  return [...(exercises || [])]
    .map((exercise) => ({
      exercise,
      ...scoreExerciseForContext(exercise, slotContext),
    }))
    .sort((a, b) => b.totalScore - a.totalScore);
}

