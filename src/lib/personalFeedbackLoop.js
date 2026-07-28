import { getAssignment, getProgramById, updateProgramInPlace } from '@/lib/programsStore';
import { getPersonalNutritionTargetLocalSync, upsertPersonalNutritionTarget } from '@/lib/personalNutritionStore';
import { getPersonalAutoAdjustmentsEnabled } from '@/lib/autoAdjustmentClarity';
import { clampAdherence0to100, clampFatigue0to10, sanitizeFiniteNumber } from '@/lib/progressMetricsValidation';

const CHECKINS_KEY = 'atlas_personal_checkins_v2';
const STATE_KEY = 'atlas_personal_state_v2';
const PROGRAM_LOG_KEY = 'atlas_personal_program_adjustments_v1';
const NUTRITION_LOG_KEY = 'atlas_personal_nutrition_adjustments_v1';
const UNDO_KEY = 'atlas_personal_adjustment_undo_v1';

function safeGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

function nowIso() {
  return new Date().toISOString();
}

function localDate() {
  return new Date().toISOString().slice(0, 10);
}

export function listPersonalCheckins(userId) {
  if (!userId) return [];
  const all = safeGet(CHECKINS_KEY, {});
  return Array.isArray(all[userId]) ? all[userId] : [];
}

export function getPersonalState(userId) {
  if (!userId) return null;
  const all = safeGet(STATE_KEY, {});
  return all[userId] || null;
}

function setPersonalState(userId, state) {
  if (!userId) return;
  const all = safeGet(STATE_KEY, {});
  all[userId] = state;
  safeSet(STATE_KEY, all);
}

function appendCheckin(userId, checkin) {
  const all = safeGet(CHECKINS_KEY, {});
  const curr = Array.isArray(all[userId]) ? all[userId] : [];
  all[userId] = [checkin, ...curr].slice(0, 90);
  safeSet(CHECKINS_KEY, all);
}

function appendProgramAdjustment(userId, row) {
  const all = safeGet(PROGRAM_LOG_KEY, {});
  const curr = Array.isArray(all[userId]) ? all[userId] : [];
  all[userId] = [row, ...curr].slice(0, 60);
  safeSet(PROGRAM_LOG_KEY, all);
}

function appendNutritionAdjustment(userId, row) {
  const all = safeGet(NUTRITION_LOG_KEY, {});
  const curr = Array.isArray(all[userId]) ? all[userId] : [];
  all[userId] = [row, ...curr].slice(0, 60);
  safeSet(NUTRITION_LOG_KEY, all);
}

function setUndoPayload(userId, payload) {
  const all = safeGet(UNDO_KEY, {});
  all[userId] = payload;
  safeSet(UNDO_KEY, all);
}

function getUndoPayload(userId) {
  const all = safeGet(UNDO_KEY, {});
  return all[userId] || null;
}

/** Count logged program + nutrition auto-adjustments (proxy for heavy solo tweaking). */
export function getPersonalAdjustmentLogCount(userId) {
  if (!userId) return 0;
  const program = safeGet(PROGRAM_LOG_KEY, {});
  const nutrition = safeGet(NUTRITION_LOG_KEY, {});
  const pa = Array.isArray(program[userId]) ? program[userId].length : 0;
  const na = Array.isArray(nutrition[userId]) ? nutrition[userId].length : 0;
  return pa + na;
}

export function getLatestPersonalAdjustmentSummary(userId) {
  if (!userId) return null;
  const program = safeGet(PROGRAM_LOG_KEY, {});
  const nutrition = safeGet(NUTRITION_LOG_KEY, {});
  const p = Array.isArray(program[userId]) ? program[userId][0] : null;
  const n = Array.isArray(nutrition[userId]) ? nutrition[userId][0] : null;
  if (!p && !n) return null;
  if (p && !n) return { kind: 'program', ...p };
  if (!p && n) return { kind: 'nutrition', ...n };
  return new Date(p.created_at).getTime() >= new Date(n.created_at).getTime()
    ? { kind: 'program', ...p }
    : { kind: 'nutrition', ...n };
}

function computeState(recent) {
  const latest = recent[0];
  const prev = recent[1] || null;
  const fatigueRaw = Math.round(
    ((6 - sanitizeFiniteNumber(latest.energy, 3)) * 1.8) +
      ((6 - sanitizeFiniteNumber(latest.recovery, 3)) * 2.2) +
      ((6 - sanitizeFiniteNumber(latest.sleep, 3)) * 1.8) +
      sanitizeFiniteNumber(latest.stress, 3) * 1.8 +
      sanitizeFiniteNumber(latest.hunger, 3) * 1.0
  );
  const fatigueScore = clampFatigue0to10(fatigueRaw);
  const adherenceScore = clampAdherence0to100(latest.adherence);
  const weightTrend =
    prev?.weight != null && latest?.weight != null
      ? Number(latest.weight) - Number(prev.weight) > 0.15
        ? 'up'
        : Number(prev.weight) - Number(latest.weight) > 0.15
          ? 'down'
          : 'flat'
      : 'flat';
  const strengthTrend = fatigueScore >= 8 ? 'declining' : fatigueScore <= 4 && adherenceScore >= 80 ? 'improving' : 'stable';
  const riskFlag = fatigueScore >= 8 || adherenceScore < 60 || strengthTrend === 'declining';
  return {
    fatigue_score: fatigueScore,
    adherence_score: adherenceScore,
    weight_trend: weightTrend,
    strength_trend: strengthTrend,
    risk_flag: riskFlag,
    updated_at: nowIso(),
  };
}

function decide(state) {
  if (state.fatigue_score >= 8) {
    return { type: 'reduce_volume', reason: 'Adjusted due to fatigue' };
  }
  if (state.adherence_score < 60) {
    return { type: 'flag_adherence', reason: 'Flagged for low adherence' };
  }
  if (state.strength_trend === 'declining' && state.weight_trend === 'flat') {
    return { type: 'adjust_plan', reason: 'Adjusted because progress stalled' };
  }
  return { type: 'on_track', reason: 'On track' };
}

function applyProgramAdjustment(userId, decision, state) {
  const assignedProgramId = getAssignment(userId);
  if (!assignedProgramId) return null;
  const program = getProgramById(assignedProgramId);
  if (!program || !Array.isArray(program.days)) return null;
  let changed = false;
  const prevDays = JSON.parse(JSON.stringify(program.days));
  const nextDays = program.days.map((day) => ({
    ...day,
    exercises: (Array.isArray(day.exercises) ? day.exercises : []).map((ex) => {
      const currSets = Math.max(1, Number(ex.sets) || 3);
      const currRest = Math.max(30, Number(ex.restSeconds ?? ex.rest_seconds) || 90);
      if (decision.type === 'reduce_volume') {
        changed = true;
        return { ...ex, sets: Math.max(1, currSets - 1), restSeconds: currRest + 30 };
      }
      if (decision.type === 'adjust_plan') {
        changed = true;
        return { ...ex, sets: Math.min(6, currSets + 1), reps: ex.reps || '8-12', restSeconds: Math.max(60, currRest - 15) };
      }
      return ex;
    }),
  }));
  if (!changed) return null;
  updateProgramInPlace(program.id, { days: nextDays });
  const row = {
    created_at: nowIso(),
    decision_type: decision.type,
    reason: decision.reason,
    summary: decision.type === 'reduce_volume' ? 'Reduced sets and increased rest.' : 'Increased sets slightly and tightened rest.',
    why_line: programWhyLine(decision, state),
  };
  appendProgramAdjustment(userId, row);
  setUndoPayload(userId, { ...(getUndoPayload(userId) || {}), program: { programId: program.id, prevDays } });
  return row;
}

function applyNutritionAdjustment(userId, decision, state) {
  const target = getPersonalNutritionTargetLocalSync(userId);
  if (!target) return null;
  const prev = { calories: target.calories, protein_g: target.protein_g, carbs_g: target.carbs_g, fats_g: target.fats_g };
  let calories = Number(target.calories || 0);
  let carbs = Number(target.carbs_g || 0);
  let fats = Number(target.fats_g || 0);
  if (decision.type === 'reduce_volume') {
    carbs = Math.max(0, carbs + 20);
    fats = Math.max(0, fats + 5);
    calories = Math.max(0, calories + 120);
  } else if (decision.type === 'adjust_plan') {
    carbs = Math.max(0, carbs - 20);
    fats = Math.max(0, fats - 5);
    calories = Math.max(0, calories - 120);
  } else {
    return null;
  }
  upsertPersonalNutritionTarget(userId, {
    calories,
    protein_g: target.protein_g,
    carbs_g: carbs,
    fats_g: fats,
  });
  const row = {
    created_at: nowIso(),
    decision_type: decision.type,
    reason: decision.reason,
    summary: decision.type === 'reduce_volume' ? 'Raised calories to support recovery.' : 'Trimmed calories to restart progress.',
    calories,
    carbs_g: carbs,
    fats_g: fats,
  };
  appendNutritionAdjustment(userId, row);
  setUndoPayload(userId, { ...(getUndoPayload(userId) || {}), nutrition: prev });
  return row;
}

export function runPersonalFeedbackLoop(userId, payload) {
  if (!userId) return null;
  const checkin = {
    id: `pc-${Date.now()}`,
    user_id: userId,
    day_date: localDate(),
    weight: payload.weight ?? null,
    energy: payload.energy ?? null,
    recovery: payload.recovery ?? null,
    sleep: payload.sleep ?? null,
    stress: payload.stress ?? null,
    hunger: payload.appetite ?? payload.hunger ?? null,
    adherence: payload.adherence ?? null,
    notes: payload.notes || '',
    created_at: nowIso(),
  };
  appendCheckin(userId, checkin);
  const recent = listPersonalCheckins(userId);
  const state = computeState(recent);
  setPersonalState(userId, state);
  const decision = decide(state);
  const autoOn = getPersonalAutoAdjustmentsEnabled(userId);
  const programAdjustment = autoOn ? applyProgramAdjustment(userId, decision, state) : null;
  const nutritionAdjustment = autoOn ? applyNutritionAdjustment(userId, decision, state) : null;
  return {
    checkin,
    state,
    decision,
    programAdjustment,
    nutritionAdjustment,
    auto_adjustments_enabled: autoOn,
  };
}

export function undoLatestPersonalAdjustment(userId) {
  if (!userId) return false;
  const undo = getUndoPayload(userId);
  if (!undo) return false;
  if (undo.program?.programId && Array.isArray(undo.program.prevDays)) {
    updateProgramInPlace(undo.program.programId, { days: undo.program.prevDays });
  }
  if (undo.nutrition) {
    upsertPersonalNutritionTarget(userId, undo.nutrition);
  }
  const all = safeGet(UNDO_KEY, {});
  delete all[userId];
  safeSet(UNDO_KEY, all);
  return true;
}

