/**
 * Shared nutrition interpretation engine for Personal and Client wrappers.
 * Interprets daily target vs intake with goal-aware, role-aware copy.
 */

function normalizeGoalKey(goalRaw) {
  const raw = String(goalRaw || '').trim().toLowerCase();
  if (!raw) return 'maintenance';
  if (['build_muscle', 'bulk', 'hypertrophy', 'muscle_gain', 'gain'].includes(raw)) return 'build_muscle';
  if (['lose_fat', 'fat_loss', 'cut', 'weight_loss'].includes(raw)) return 'lose_fat';
  if (['competition_prep', 'prep', 'competition'].includes(raw)) return 'competition_prep';
  if (['general_fitness', 'general fitness', 'maintenance', 'maintain', 'recomp'].includes(raw)) return 'maintenance';
  return 'maintenance';
}

function topMacroGapKey(remaining, targets) {
  const rows = [
    { key: 'protein', rem: Number(remaining?.protein_g) || 0, tgt: Number(targets?.protein_g) || 0 },
    { key: 'carbs', rem: Number(remaining?.carbs_g) || 0, tgt: Number(targets?.carbs_g) || 0 },
    { key: 'fats', rem: Number(remaining?.fats_g) || 0, tgt: Number(targets?.fats_g) || 0 },
  ]
    .filter((r) => r.tgt > 0)
    .map((r) => ({ ...r, shareLeft: Math.max(0, r.rem) / r.tgt }))
    .sort((a, b) => b.shareLeft - a.shareLeft);
  return rows[0]?.key ?? null;
}

/**
 * Shared engine with thin role wrappers through copy.
 * role: 'personal' | 'client'
 */
export function deriveNutritionStatusLine({
  role = 'personal',
  goal,
  targetCalories,
  consumedCalories,
  remaining,
  targets,
  trainingDay = false,
}) {
  const target = Number(targetCalories) || 0;
  const consumed = Number(consumedCalories) || 0;
  if (target <= 0) return null;

  const delta = consumed - target;
  const pctDiff = (delta / target) * 100;
  const absPctDiff = Math.abs(pctDiff);
  const direction = delta > 0 ? 'over' : delta < 0 ? 'under' : 'on_target';
  const band = absPctDiff <= 5 ? 'on_track' : absPctDiff <= 10 ? 'slightly_off' : 'meaningfully_off';
  const goalKey = normalizeGoalKey(goal);
  const macroGap = topMacroGapKey(remaining, targets);
  const isClient = role === 'client';

  const rolePhrase = (textPersonal, textClient) => (isClient ? textClient : textPersonal);

  let line = 'On track for today';
  if (goalKey === 'build_muscle') {
    if (direction === 'under' && band === 'slightly_off') line = rolePhrase('Slightly under target for a gaining phase', "Slightly under today's gaining target");
    else if (direction === 'under' && band === 'meaningfully_off') line = rolePhrase('Below target, recovery may be harder if this continues', 'Below target today - recovery may be harder if this continues');
    else if (direction === 'over' && band === 'meaningfully_off') line = rolePhrase('Above target today - keep the finish more balanced', 'Above target today - a more balanced finish keeps execution cleaner');
  } else if (goalKey === 'lose_fat') {
    if (direction === 'over' && band === 'slightly_off') line = rolePhrase('Slightly above target for fat loss', "Slightly above today's fat-loss target");
    else if (direction === 'over' && band === 'meaningfully_off') line = rolePhrase("Above target for today's cut, a lighter final meal would tighten the day", "Above today's cut target - a lighter final meal can tighten the day");
    else if (direction === 'under' && band !== 'on_track') line = 'Slightly under target today';
  } else if (goalKey === 'competition_prep') {
    if (band === 'on_track') line = 'On track for prep today';
    else if (direction === 'under' && band === 'slightly_off') line = 'Slightly under prep target today';
    else if (direction === 'over' && band === 'slightly_off') line = 'Slightly above prep target today';
    else if (direction === 'under' && band === 'meaningfully_off') line = 'Meaningfully under prep target - recovery may be harder';
    else if (direction === 'over' && band === 'meaningfully_off') line = 'Meaningfully above prep target - tighten the final meal';
  } else {
    if (direction === 'under' && band === 'meaningfully_off') line = 'Meaningfully under target today';
    else if (direction === 'over' && band === 'meaningfully_off') line = 'Meaningfully above target today';
    else if (direction !== 'on_target' && band === 'slightly_off') line = direction === 'under' ? 'Slightly under target today' : 'Slightly above target today';
  }

  let suggestion = rolePhrase('Keep logging meals to stay consistent.', 'Keep logging so your coach sees a clean daily signal.');
  if (macroGap === 'protein') {
    suggestion = rolePhrase(
      'Protein is still the biggest gap, so make the next meal protein-forward.',
      'Protein is still the biggest gap; prioritize protein in the next meal for better recovery.'
    );
  } else if (macroGap === 'carbs' && trainingDay) {
    suggestion = rolePhrase(
      'Carbs are still behind on a training day, so top up with an easier-to-digest carb source.',
      'Carbs are behind for a training day; topping up can improve session fuel and coach-plan execution.'
    );
  } else if (macroGap === 'fats' && direction === 'over') {
    suggestion = rolePhrase(
      'Most overage is likely from fats, so keep the final meal leaner to tighten the day.',
      'Most overage appears to come from fats; a leaner close can tighten adherence.'
    );
  } else if (goalKey === 'build_muscle' && direction === 'under') {
    suggestion = rolePhrase(
      'Still room left - a balanced final meal can support recovery.',
      'Still room left - a balanced final meal supports recovery and coach plan intent.'
    );
  } else if (goalKey === 'lose_fat' && direction === 'over') {
    suggestion = rolePhrase(
      'Keep the final meal lighter to tighten the day.',
      'A lighter final meal keeps the day closer to your cut target.'
    );
  } else if (direction === 'under') {
    suggestion = rolePhrase(
      'There is still room left if you want to round out today.',
      'There is still room left if you need to round out the day.'
    );
  } else if (direction === 'over') {
    suggestion = rolePhrase(
      'A lighter close can keep today in a tighter range.',
      'A lighter close can tighten daily adherence for review.'
    );
  }

  return {
    tone: band === 'on_track' ? 'positive' : band === 'slightly_off' ? 'neutral' : 'caution',
    line,
    suggestion,
    band,
    direction,
    pctDiff,
    goalKey,
    macroGap,
  };
}

