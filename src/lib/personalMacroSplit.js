/**
 * Personal nutrition: default macro grams from daily calories + optional bodyweight (kg),
 * with preset splits and rebalance when some macros are user-locked.
 */

import { profileCurrentWeightKg } from '@/lib/bodyMeasurementUnits';

export const MACRO_PRESET_IDS = ['balanced', 'higher_carb', 'higher_protein', 'lower_fat'];

/** @type {Record<string, { id: string, label: string, bodyweight: { proteinPerKg: number, fatPerKg: number }, percent: { protein: number, fat: number } }>} */
export const MACRO_PRESETS = {
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    bodyweight: { proteinPerKg: 2.2, fatPerKg: 0.8 },
    percent: { protein: 0.25, fat: 0.25 },
  },
  higher_carb: {
    id: 'higher_carb',
    label: 'Higher carb',
    bodyweight: { proteinPerKg: 2.0, fatPerKg: 0.65 },
    percent: { protein: 0.22, fat: 0.22 },
  },
  higher_protein: {
    id: 'higher_protein',
    label: 'Higher protein',
    bodyweight: { proteinPerKg: 2.6, fatPerKg: 0.75 },
    percent: { protein: 0.32, fat: 0.22 },
  },
  lower_fat: {
    id: 'lower_fat',
    label: 'Lower fat',
    bodyweight: { proteinPerKg: 2.2, fatPerKg: 0.5 },
    percent: { protein: 0.28, fat: 0.18 },
  },
};

const LB_TO_KG = 0.45359237;

/**
 * @param {number | null | undefined} weight
 * @param {string | null | undefined} units profiles.units ('kg' | 'lb' etc.)
 * @returns {number | null} kg or null
 */
export function profileWeightToKg(weight, units) {
  const w = Number(weight);
  if (!Number.isFinite(w) || w <= 0) return null;
  const u = String(units || 'kg').toLowerCase();
  if (u === 'lb' || u === 'lbs' || u === 'imperial') return w * LB_TO_KG;
  return w;
}

/**
 * @param {{ baseline_weight_kg?: number | null } | null} personalRow
 * @param {{ current_weight?: number | null, units?: string | null, bodyweight_unit?: string | null, weight_unit?: string | null } | null} profileRow
 */
export function resolvePersonalBodyweightKg(personalRow, profileRow) {
  const b = Number(personalRow?.baseline_weight_kg);
  if (Number.isFinite(b) && b > 0) return b;
  const canonical = profileCurrentWeightKg(profileRow);
  if (canonical != null) return canonical;
  return profileWeightToKg(profileRow?.current_weight, profileRow?.units);
}

export function macroCaloriesFromGrams(p, c, f) {
  const P = Number(p) || 0;
  const C = Number(c) || 0;
  const F = Number(f) || 0;
  return 4 * P + 4 * C + 9 * F;
}

/**
 * Full split when no locks (or preset change).
 * @param {number} totalCalories
 * @param {number | null} weightKg
 * @param {keyof typeof MACRO_PRESETS} presetId
 */
export function computePersonalMacroGrams(totalCalories, weightKg, presetId = 'balanced') {
  const preset = MACRO_PRESETS[presetId] || MACRO_PRESETS.balanced;
  const cal = Number(totalCalories);
  if (!Number.isFinite(cal) || cal <= 0) {
    return { protein_g: 0, carbs_g: 0, fats_g: 0 };
  }

  const w = Number(weightKg);
  if (Number.isFinite(w) && w > 0) {
    const { proteinPerKg, fatPerKg } = preset.bodyweight;
    const p = Math.round(proteinPerKg * w);
    const f = Math.round(fatPerKg * w);
    const c = Math.round((cal - 4 * p - 9 * f) / 4);
    return {
      protein_g: Math.max(0, p),
      carbs_g: Math.max(0, c),
      fats_g: Math.max(0, f),
    };
  }

  const { protein: pShare, fat: fShare } = preset.percent;
  const p = Math.round((cal * pShare) / 4);
  const f = Math.round((cal * fShare) / 9);
  const c = Math.round((cal - 4 * p - 9 * f) / 4);
  return {
    protein_g: Math.max(0, p),
    carbs_g: Math.max(0, c),
    fats_g: Math.max(0, f),
  };
}

/**
 * @param {{ protein?: boolean, carbs?: boolean, fats?: boolean }} locks
 * @param {{ protein?: number, carbs?: number, fats?: number }} lockedGrams — values for locked macros
 */
export function rebalancePersonalMacros({
  totalCalories,
  weightKg,
  presetId = 'balanced',
  locks,
  lockedGrams,
}) {
  const cal = Number(totalCalories);
  if (!Number.isFinite(cal) || cal <= 0) {
    return { protein_g: 0, carbs_g: 0, fats_g: 0 };
  }

  const preset = MACRO_PRESETS[presetId] || MACRO_PRESETS.balanced;
  const uP = !locks?.protein;
  const uC = !locks?.carbs;
  const uF = !locks?.fats;

  const g = {
    p: Number(lockedGrams?.protein),
    c: Number(lockedGrams?.carbs),
    f: Number(lockedGrams?.fats),
  };

  if (uP && uC && uF) {
    return computePersonalMacroGrams(cal, weightKg, presetId);
  }

  const kcalLocked =
    (!uP && Number.isFinite(g.p) && g.p >= 0 ? 4 * g.p : 0) +
    (!uC && Number.isFinite(g.c) && g.c >= 0 ? 4 * g.c : 0) +
    (!uF && Number.isFinite(g.f) && g.f >= 0 ? 9 * g.f : 0);

  let R = cal - kcalLocked;
  if (!Number.isFinite(R)) R = cal;
  R = Math.max(0, R);

  const out = {
    protein_g: uP ? 0 : Math.round(Math.max(0, g.p)),
    carbs_g: uC ? 0 : Math.round(Math.max(0, g.c)),
    fats_g: uF ? 0 : Math.round(Math.max(0, g.f)),
  };

  const pShare = preset.percent.protein;
  const fShare = preset.percent.fat;
  const cShare = Math.max(0, 1 - pShare - fShare);
  const w = Number(weightKg);
  const hasBw = Number.isFinite(w) && w > 0;
  const { proteinPerKg, fatPerKg } = preset.bodyweight;

  // One unlocked: assign all remaining kcal to that macro
  if (uP && !uC && !uF) {
    out.protein_g = Math.max(0, Math.round(R / 4));
    return out;
  }
  if (!uP && uC && !uF) {
    out.carbs_g = Math.max(0, Math.round(R / 4));
    return out;
  }
  if (!uP && !uC && uF) {
    out.fats_g = Math.max(0, Math.round(R / 9));
    return out;
  }

  // Two unlocked
  if (uP && uC && !uF) {
    if (hasBw) {
      out.protein_g = Math.max(0, Math.round(proteinPerKg * w));
      out.carbs_g = Math.max(0, Math.round((R - 4 * out.protein_g) / 4));
    } else {
      const denom = pShare + cShare;
      const pK = denom > 0 ? (R * pShare) / denom : R / 2;
      const cK = R - pK;
      out.protein_g = Math.max(0, Math.round(pK / 4));
      out.carbs_g = Math.max(0, Math.round(cK / 4));
    }
    return out;
  }

  if (uP && !uC && uF) {
    if (hasBw) {
      out.protein_g = Math.max(0, Math.round(proteinPerKg * w));
      out.fats_g = Math.max(0, Math.round((R - 4 * out.protein_g) / 9));
    } else {
      const denom = pShare + fShare;
      const pK = denom > 0 ? (R * pShare) / denom : R / 2;
      const fK = R - pK;
      out.protein_g = Math.max(0, Math.round(pK / 4));
      out.fats_g = Math.max(0, Math.round(fK / 9));
    }
    return out;
  }

  if (!uP && uC && uF) {
    if (hasBw) {
      out.fats_g = Math.max(0, Math.round(fatPerKg * w));
      out.carbs_g = Math.max(0, Math.round((R - 9 * out.fats_g) / 4));
    } else {
      const denom = fShare + cShare;
      const fK = denom > 0 ? (R * fShare) / denom : R / 2;
      const cK = R - fK;
      out.fats_g = Math.max(0, Math.round(fK / 9));
      out.carbs_g = Math.max(0, Math.round(cK / 4));
    }
    return out;
  }

  // All locked (should not call for recalc often) — return locked grams
  return {
    protein_g: Math.round(Math.max(0, g.p)),
    carbs_g: Math.round(Math.max(0, g.c)),
    fats_g: Math.round(Math.max(0, g.f)),
  };
}
