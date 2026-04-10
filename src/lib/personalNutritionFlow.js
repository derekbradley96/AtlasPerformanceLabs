/**
 * Personal nutrition UX helpers: remaining macros, workout readiness copy, quick-add hints.
 */
import { nutritionTrainingLinkLine } from '@/lib/personalAdaptationLayer';
import { deriveNutritionStatusLine } from '@/lib/nutritionInterpretation';

const MACRO_ROWS = [
  { key: 'protein', label: 'Protein', remKey: 'protein_g', tgtKey: 'protein_g', unit: 'g' },
  { key: 'carbs', label: 'Carbs', remKey: 'carbs_g', tgtKey: 'carbs_g', unit: 'g' },
  { key: 'fats', label: 'Fats', remKey: 'fats_g', tgtKey: 'fats_g', unit: 'g' },
  { key: 'calories', label: 'Calories', remKey: 'calories', tgtKey: 'calories', unit: 'kcal' },
];

/**
 * Macros sorted by how much of the daily target is *still unfilled* (highest share of target left first).
 * @param {{ calories: number, protein_g: number, carbs_g: number, fats_g: number }} remaining
 * @param {{ calories: number, protein_g: number, carbs_g: number, fats_g: number }} targets
 */
export function rankMacroShortfalls(remaining, targets) {
  const rows = MACRO_ROWS.map((m) => {
    const rem = Math.max(0, Number(remaining?.[m.remKey]) || 0);
    const tgt = Math.max(0, Number(targets?.[m.tgtKey]) || 0);
    const shareLeft = tgt > 0 ? rem / tgt : 0;
    return { ...m, rem, tgt, shareLeft };
  }).filter((r) => r.tgt > 0);

  rows.sort((a, b) => b.shareLeft - a.shareLeft);
  return rows;
}

/** One-line “what you’re most behind on” when something meaningful is left. */
export function primaryShortfallLine(ranked) {
  const top = ranked.find((r) => r.rem > 0);
  if (!top) return null;
  if (top.key === 'calories') return `Most room left: ~${Math.round(top.rem)} kcal`;
  return `Most room left: ${top.label} (~${Math.round(top.rem)}g)`;
}

/**
 * Lines for the workout-readiness card (basic vs enhanced).
 * @param {{ proteinPct: number|null, caloriePct: number|null, nextWorkoutTitle?: string|null, tier?: 'basic'|'enhanced' }} args
 * @returns {string[]}
 */
export function buildWorkoutFuelLines({ proteinPct, caloriePct, nextWorkoutTitle, tier = 'basic' }) {
  const lines = [];
  const nw = nextWorkoutTitle && String(nextWorkoutTitle).trim();
  const p = proteinPct != null ? Number(proteinPct) : null;
  const c = caloriePct != null ? Number(caloriePct) : null;

  if (nw) {
    if (tier === 'enhanced') {
      lines.push(
        `Next session: ${nw}. Protein and calories you bank today are what power output and recovery on that work.`
      );
      if (p != null && p < 78) {
        lines.push('Protein is still light — bias your next meal toward lean protein so that session isn’t under-recovered.');
      } else if (c != null && c < 72 && (p == null || p < 88)) {
        lines.push('Calories are under budget — add a structured snack so glycogen and focus hold up in training.');
      }
    } else {
      lines.push(`Next session: ${nw}. Aim at today’s targets so you show up fueled.`);
    }
  }

  const fuel = nutritionTrainingLinkLine({ proteinPct, caloriePct });
  if (fuel) lines.push(fuel);

  if (!lines.length) {
    lines.push(
      tier === 'enhanced'
        ? 'Log meals against your targets to see how today’s fuel supports your next hard set.'
        : 'Log meals to connect what you eat with how you train.'
    );
  }

  return lines;
}

const QUICK_PRESETS = {
  protein25: {
    label: 'Protein +25g',
    payload: { meal_type: 'snack', calories: 160, protein_g: 25, carbs_g: 4, fats_g: 4, notes: 'Quick protein hit' },
  },
  carbs35: {
    label: 'Carbs +35g',
    payload: { meal_type: 'snack', calories: 140, protein_g: 2, carbs_g: 35, fats_g: 2, notes: 'Quick carbs' },
  },
  balanced450: {
    label: 'Balanced meal +450',
    payload: { meal_type: 'meal', calories: 450, protein_g: 35, carbs_g: 45, fats_g: 12, notes: 'Quick balanced meal' },
  },
  light150: {
    label: 'Light +150',
    payload: { meal_type: 'snack', calories: 150, protein_g: 12, carbs_g: 6, fats_g: 6, notes: 'Light snack' },
  },
  snack160: {
    label: 'Snack +160',
    payload: { meal_type: 'snack', calories: 160, protein_g: 20, carbs_g: 8, fats_g: 5, notes: 'Balanced snack' },
  },
};

/**
 * Contextual quick-add presets: ordered by remaining macros vs targets (no modal — caller logs on tap).
 * @param {object} remaining
 * @param {object} [targets] daily targets; when set, suggestions prioritize the biggest gap.
 */
export function suggestPersonalQuickAdds(remaining, targets) {
  const p = Math.max(0, Number(remaining?.protein_g) || 0);
  const c = Math.max(0, Number(remaining?.carbs_g) || 0);
  const cal = Math.max(0, Number(remaining?.calories) || 0);
  const suggestions = [];
  const pushUnique = (item) => {
    if (!item || suggestions.some((s) => s.label === item.label)) return;
    suggestions.push(item);
  };

  const hasTargets =
    targets &&
    (Number(targets.calories) > 0 ||
      Number(targets.protein_g) > 0 ||
      Number(targets.carbs_g) > 0 ||
      Number(targets.fats_g) > 0);

  let topKey = null;
  if (hasTargets && remaining) {
    const ranked = rankMacroShortfalls(remaining, targets);
    topKey = ranked[0]?.key ?? null;
  }

  if (!hasTargets) {
    pushUnique(QUICK_PRESETS.protein25);
    pushUnique(QUICK_PRESETS.carbs35);
    pushUnique(QUICK_PRESETS.snack160);
    pushUnique(QUICK_PRESETS.light150);
    return suggestions.slice(0, 4);
  }

  const proteinFirst = topKey === 'protein' || (p >= c && p >= 15);
  const caloriesTight = cal > 0 && cal < 220;
  const caloriesPlenty = cal >= 320;

  if (proteinFirst && p >= 18) {
    pushUnique(QUICK_PRESETS.protein25);
  }
  if (topKey === 'carbs' && c >= 22) {
    pushUnique(QUICK_PRESETS.carbs35);
  } else if (!proteinFirst && c >= 25) {
    pushUnique(QUICK_PRESETS.carbs35);
  }

  if (caloriesTight) {
    pushUnique(QUICK_PRESETS.light150);
  } else if (caloriesPlenty) {
    pushUnique(QUICK_PRESETS.balanced450);
  }

  if (p >= 20) {
    pushUnique(QUICK_PRESETS.protein25);
  }
  if (c >= 25) {
    pushUnique(QUICK_PRESETS.carbs35);
  }
  if (cal >= 350) {
    pushUnique(QUICK_PRESETS.balanced450);
  }

  if (!suggestions.length) {
    pushUnique(QUICK_PRESETS.snack160);
  } else if (suggestions.length < 3) {
    pushUnique(QUICK_PRESETS.snack160);
    pushUnique(QUICK_PRESETS.light150);
  }

  return suggestions.slice(0, 4);
}

export function deriveGoalAwareCalorieStatus({ goal, targetCalories, consumedCalories, remaining, progressTargets }) {
  return deriveNutritionStatusLine({
    role: 'personal',
    goal,
    targetCalories,
    consumedCalories,
    remaining,
    targets: progressTargets,
  });
}
