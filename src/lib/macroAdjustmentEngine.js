/**
 * Coach-facing macro adjustment suggestions from weight trend + nutrition adherence (Law 7).
 * Pure engine — no I/O.
 */

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeGoal(clientGoal) {
  const g = String(clientGoal || 'maintenance').toLowerCase();
  if (g === 'build_muscle' || g === 'bulk') return 'build_muscle';
  if (g === 'lose_fat' || g === 'cut' || g === 'fat_loss') return 'lose_fat';
  if (g === 'competition_prep' || g === 'prep' || g === 'competition') return 'competition_prep';
  return 'maintenance';
}

function sortByDateAsc(rows, dateKey) {
  return [...(rows || [])]
    .filter((r) => r && r[dateKey])
    .map((r) => ({ ...r, _d: String(r[dateKey]).slice(0, 10) }))
    .sort((a, b) => (a._d < b._d ? -1 : a._d > b._d ? 1 : 0));
}

/**
 * @param {Array<{ log_date: string, weight?: number|null }>} recentWeights
 */
export function computeWeightChangeKgPerWeek(recentWeights) {
  const sorted = sortByDateAsc(recentWeights, 'log_date').filter((r) => num(r.weight) != null);
  if (sorted.length < 2) return { rateKgPerWeek: null, spanDays: 0, confidence: 'low' };
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const w0 = num(first.weight);
  const w1 = num(last.weight);
  const t0 = new Date(`${first._d}T12:00:00`).getTime();
  const t1 = new Date(`${last._d}T12:00:00`).getTime();
  const spanDays = Math.max(1, Math.round((t1 - t0) / 86400000));
  const rate = (w1 - w0) / (spanDays / 7);
  const confidence = sorted.length >= 8 && spanDays >= 7 ? 'high' : sorted.length >= 4 ? 'medium' : 'low';
  return { rateKgPerWeek: rate, spanDays, confidence };
}

function averageAdherence(recentAdherence) {
  const vals = (recentAdherence || [])
    .map((r) => num(r.macros_hit_percent))
    .filter((n) => n != null && n >= 0);
  if (!vals.length) return { avg: null, count: 0 };
  return { avg: vals.reduce((a, b) => a + b, 0) / vals.length, count: vals.length };
}

function countStrongMacroDays(recentAdherence, threshold = 78) {
  const rows = recentAdherence || [];
  const withPct = rows.filter((r) => num(r.macros_hit_percent) != null);
  const hits = withPct.filter((r) => num(r.macros_hit_percent) >= threshold).length;
  return { hits, total: withPct.length };
}

function redistributeMacros({ calories, protein, carbs, fats }, newCalories) {
  const p = Math.max(0, num(protein) || 0);
  const c = Math.max(0, num(carbs) || 0);
  const f = Math.max(0, num(fats) || 0);
  const oldCal = Math.max(1, p * 4 + c * 4 + f * 9);
  const delta = newCalories - oldCal;
  let carbCal = c * 4;
  let fatCal = f * 9;
  const carbShare = 0.65;
  const fatShare = 0.35;
  carbCal = Math.max(120, carbCal + delta * carbShare);
  fatCal = Math.max(180, fatCal + delta * fatShare);
  let newCarbs = Math.round(carbCal / 4);
  let newFats = Math.round(fatCal / 9);
  let newProtein = Math.round(p);
  let rebuilt = newProtein * 4 + newCarbs * 4 + newFats * 9;
  let guard = 0;
  while (rebuilt > newCalories + 25 && guard < 12) {
    if (newCarbs > 40) newCarbs -= 5;
    else if (newFats > 25) newFats -= 2;
    else break;
    rebuilt = newProtein * 4 + newCarbs * 4 + newFats * 9;
    guard += 1;
  }
  return {
    suggestedProtein: newProtein,
    suggestedCarbs: newCarbs,
    suggestedFats: newFats,
  };
}

/**
 * @param {{
 *   currentPlan: { calories?: number|null, protein?: number|null, carbs?: number|null, fats?: number|null },
 *   recentWeights: Array<{ log_date: string, weight?: number|null }>,
 *   recentAdherence: Array<{ day_date: string, macros_hit_percent?: number|null }>,
 *   clientGoal: string,
 *   weeksToShow: number|null,
 * }} args
 */
export function analyseMacroAdjustment({
  currentPlan,
  recentWeights,
  recentAdherence,
  clientGoal,
  weeksToShow = null,
}) {
  const cal0 = num(currentPlan?.calories);
  const p0 = num(currentPlan?.protein);
  const c0 = num(currentPlan?.carbs);
  const f0 = num(currentPlan?.fats);

  const empty = {
    shouldAdjust: false,
    adjustmentType: null,
    suggestedCalories: null,
    suggestedProtein: null,
    suggestedCarbs: null,
    suggestedFats: null,
    reasoning: '',
    urgency: 'low',
    confidenceLevel: 'low',
    adherenceNote: null,
  };

  if (!cal0 || cal0 <= 0) {
    return {
      ...empty,
      reasoning: 'No calorie target on file yet — publish a nutrition plan before Atlas can suggest macro shifts.',
    };
  }

  const { rateKgPerWeek, spanDays, confidence: weightConf } = computeWeightChangeKgPerWeek(recentWeights);
  const { avg: avgAdherence, count: adhCount } = averageAdherence(recentAdherence);
  const goal = normalizeGoal(clientGoal);
  const weeksOut = weeksToShow != null && Number.isFinite(Number(weeksToShow)) ? Math.max(0, Number(weeksToShow)) : null;

  let confidenceLevel = weightConf;
  if (adhCount >= 5) confidenceLevel = confidenceLevel === 'low' ? 'medium' : 'high';
  else if (adhCount < 3) confidenceLevel = 'low';

  const highAdherence = avgAdherence != null && avgAdherence > 80;
  const lowAdherence = avgAdherence != null && avgAdherence < 70;

  const basePlan = { calories: cal0, protein: p0 || 0, carbs: c0 || 0, fats: f0 || 0 };

  const finish = (patch) => ({
    ...empty,
    ...patch,
    confidenceLevel: patch.confidenceLevel || confidenceLevel,
  });

  // --- Competition prep (weeks-aware) ---
  if (goal === 'competition_prep' && rateKgPerWeek != null) {
    if (weeksOut != null && weeksOut >= 8 && rateKgPerWeek < -0.28) {
      return finish({
        shouldAdjust: true,
        adjustmentType: 'stabilise',
        suggestedCalories: Math.round(cal0 + 75),
        ...redistributeMacros(basePlan, Math.round(cal0 + 75)),
        reasoning:
          'Weight is moving down faster than ideal this far out from show. Easing calories slightly helps protect lean tissue while keeping execution sustainable — you are ahead of schedule, so avoid cutting harder yet.',
        urgency: 'medium',
        confidenceLevel: adhCount >= 4 ? 'high' : 'medium',
      });
    }
    if (weeksOut != null && weeksOut <= 6 && rateKgPerWeek > -0.08) {
      const cut = avgAdherence != null && avgAdherence > 80 ? 200 : lowAdherence ? 0 : 175;
      if (lowAdherence && avgAdherence != null) {
        return finish({
          shouldAdjust: false,
          adjustmentType: 'adherence_issue',
          adherenceNote: `Adherence is averaging about ${Math.round(avgAdherence)}% on logged days — tighten execution before pulling calories harder this close to stage.`,
          reasoning:
            'Scale progress is soft, but nutrition adherence is also soft — fix consistency first so a cut lands on real behaviour, not noise.',
          urgency: 'high',
        });
      }
      const newCal = Math.max(1200, Math.round(cal0 - cut));
      return finish({
        shouldAdjust: cut > 0,
        adjustmentType: 'decrease',
        suggestedCalories: newCal,
        ...redistributeMacros(basePlan, newCal),
        reasoning: `Show is about ${weeksOut} week(s) out and weight is behind schedule for this phase — a modest pull on calories can sharpen the trajectory without a reckless drop. Carbs move first to keep protein protective for muscle.`,
        urgency: 'high',
        confidenceLevel: 'high',
      });
    }
  }

  // --- Lose fat ---
  if (goal === 'lose_fat' && rateKgPerWeek != null) {
    const notDroppingEnough = rateKgPerWeek > -0.1;
    if (notDroppingEnough) {
      if (lowAdherence) {
        return finish({
          shouldAdjust: false,
          adjustmentType: 'adherence_issue',
          adherenceNote:
            avgAdherence != null
              ? `Adherence is averaging about ${Math.round(avgAdherence)}% — clarify barriers before lowering calories so the client is set up to succeed.`
              : 'Limited adherence data — check logging consistency before cutting calories.',
          reasoning:
            'Weight is not moving down as expected for fat loss, but adherence is under 70% — the lever is behaviour first, not another calorie cut.',
          urgency: 'medium',
        });
      }
      if (highAdherence) {
        const delta = -150;
        const newCal = Math.max(1200, Math.round(cal0 + delta));
        return finish({
          shouldAdjust: true,
          adjustmentType: 'decrease',
          suggestedCalories: newCal,
          ...redistributeMacros(basePlan, newCal),
          reasoning:
            'Weight trend is flat despite strong adherence — a small, controlled calorie reduction is justified. Carbs absorb most of the change so protein stays high for recovery and satiety.',
          urgency: 'medium',
          confidenceLevel: spanDays >= 10 ? 'high' : 'medium',
        });
      }
    }
  }

  // --- Build muscle ---
  if (goal === 'build_muscle' && rateKgPerWeek != null) {
    const notGaining = rateKgPerWeek < 0.1;
    if (notGaining) {
      if (lowAdherence) {
        return finish({
          shouldAdjust: false,
          adjustmentType: 'adherence_issue',
          adherenceNote:
            avgAdherence != null
              ? `Adherence is averaging about ${Math.round(avgAdherence)}% — shore up consistency before pushing calories in a gaining phase.`
              : 'Limited adherence data — confirm food logging before adding calories.',
          reasoning:
            'Weight is not climbing on a muscle-gain phase, but adherence is under 70% — adding calories now mostly raises error, not lean tissue.',
          urgency: 'medium',
        });
      }
      if (highAdherence) {
        const newCal = Math.round(cal0 + 125);
        return finish({
          shouldAdjust: true,
          adjustmentType: 'increase',
          suggestedCalories: newCal,
          ...redistributeMacros(basePlan, newCal),
          reasoning:
            'Adherence is strong but the scale is not rising — a modest calorie bump is appropriate. Carbs move first to fuel training; fats move last to keep the jump controlled.',
          urgency: 'low',
          confidenceLevel: spanDays >= 10 ? 'high' : 'medium',
        });
      }
    }
  }

  // --- Maintenance drift (> ~1 kg movement across the window) ---
  if (goal === 'maintenance' && rateKgPerWeek != null) {
    const sorted = sortByDateAsc(recentWeights, 'log_date').filter((r) => num(r.weight) != null);
    if (sorted.length >= 2 && spanDays >= 5) {
      const ws = sorted.map((r) => num(r.weight)).filter((n) => n != null);
      const rangeKg = Math.max(...ws) - Math.min(...ws);
      const net = (num(sorted[sorted.length - 1].weight) || 0) - (num(sorted[0].weight) || 0);
      if (rangeKg > 1 || Math.abs(net) > 1) {
        const bump = net > 0.6 || rateKgPerWeek > 0.15 ? -85 : net < -0.6 || rateKgPerWeek < -0.15 ? 85 : 0;
        if (bump !== 0) {
          const newCal = Math.max(1200, Math.round(cal0 + bump));
          return finish({
            shouldAdjust: true,
            adjustmentType: bump < 0 ? 'decrease' : 'increase',
            suggestedCalories: newCal,
            ...redistributeMacros(basePlan, newCal),
            reasoning:
              'For maintenance, bodyweight has drifted more than about a kilogram across the last couple of weeks — a small calorie nudge (mostly from carbs, fats last) recentres the trend without turning it into a full cut or bulk.',
            urgency: 'low',
          });
        }
      }
    }
  }

  const { hits, total } = countStrongMacroDays(recentAdherence, 78);
  let adherenceNote = null;
  if (avgAdherence != null && avgAdherence < 70 && total >= 4) {
    adherenceNote = `Macro execution is averaging about ${Math.round(avgAdherence)}% on logged days (${hits} of ${total} days at or above ~78% hit rate). Consider checking in on barriers before adjusting targets.`;
  }

  return finish({
    shouldAdjust: false,
    adjustmentType: null,
    suggestedCalories: null,
    suggestedProtein: null,
    suggestedCarbs: null,
    suggestedFats: null,
    reasoning:
      rateKgPerWeek == null
        ? 'Not enough weight history in the last two weeks to judge trend — keep collecting check-ins and scale data before changing targets.'
        : 'Weight trend and adherence look within a normal band for this goal — Atlas is staying quiet so you do not oversteer a client who is executing.',
    urgency: 'low',
    adherenceNote,
  });
}
