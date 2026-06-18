/**
 * Post-log coaching copy (Law 7) — compares projected daily totals vs targets after one meal.
 * @param {{ calories?: number|null, protein_g?: number|null, carbs_g?: number|null, fats_g?: number|null }} added
 * @param {{ calories?: number, protein_g?: number, carbs_g?: number, fats_g?: number }} dailyTotals before this log
 * @param {{ calories?: number, protein_g?: number, carbs_g?: number, fats_g?: number }} targets
 */
export function buildMealLogInterpretation({ added, dailyTotals, targets }) {
  const a = {
    calories: Number(added?.calories) || 0,
    protein_g: Number(added?.protein_g) || 0,
    carbs_g: Number(added?.carbs_g) || 0,
    fats_g: Number(added?.fats_g) || 0,
  };
  const base = {
    calories: Number(dailyTotals?.calories) || 0,
    protein_g: Number(dailyTotals?.protein_g) || 0,
    carbs_g: Number(dailyTotals?.carbs_g) || 0,
    fats_g: Number(dailyTotals?.fats_g) || 0,
  };
  const proj = {
    calories: base.calories + a.calories,
    protein_g: base.protein_g + a.protein_g,
    carbs_g: base.carbs_g + a.carbs_g,
    fats_g: base.fats_g + a.fats_g,
  };
  const T = {
    calories: Number(targets?.calories) || 0,
    protein_g: Number(targets?.protein_g) || 0,
    carbs_g: Number(targets?.carbs_g) || 0,
    fats_g: Number(targets?.fats_g) || 0,
  };
  const hasTargets = T.calories > 0 || T.protein_g > 0 || T.carbs_g > 0 || T.fats_g > 0;
  if (!hasTargets) return null;

  const parts = [];
  if (T.protein_g > 0 && proj.protein_g >= T.protein_g) {
    parts.push("Great — you've hit your protein target for today.");
  }

  const carbShort = T.carbs_g > 0 ? Math.max(0, T.carbs_g - proj.carbs_g) : 0;
  if (carbShort >= 120) {
    parts.push(`Carbs still about ${Math.round(carbShort)}g short — consider adding rice with your next meal.`);
  } else if (carbShort >= 35) {
    parts.push(`Carbs are still about ${Math.round(carbShort)}g under target — rice, fruit, or bread can help.`);
  } else if (carbShort >= 15) {
    parts.push(`You're about ${Math.round(carbShort)}g under on carbs for today.`);
  }

  const fatShort = T.fats_g > 0 ? Math.max(0, T.fats_g - proj.fats_g) : 0;
  if (fatShort >= 20 && parts.length < 2) {
    parts.push(`Fats are still about ${Math.round(fatShort)}g short — nuts, olive oil, or avocado work well.`);
  }

  if (parts.length) return parts.slice(0, 2).join(' ');

  if (T.calories > 0) {
    const calRemain = T.calories - proj.calories;
    if (calRemain < -200) return "You're over your calorie target for today; keep the next meal lighter.";
    if (calRemain > 400) return `You still have roughly ${Math.round(calRemain)} calories of room today while staying on plan.`;
  }
  return null;
}
