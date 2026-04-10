import { rankExercisesForSlot } from '@/lib/exerciseScoringEngine';
import { personalAutoProgramContextAllowed } from '@/lib/personalTierPolicy';

function toDays(daysPerWeek) {
  return Math.max(2, Math.min(6, Number(daysPerWeek) || 3));
}

function repRangeForGoal(goal, slotType) {
  const g = String(goal || 'muscle').toLowerCase();
  if (slotType === 'primary_compound') return g === 'competition' ? '3-6' : '5-8';
  if (slotType === 'secondary_compound') return g === 'fat_loss' ? '8-12' : '6-10';
  if (slotType === 'isolation') return '10-15';
  if (slotType === 'finisher') return g === 'fat_loss' ? '12-20' : '10-15';
  return '8-12';
}

function restForSlot(slotType, goal) {
  if (slotType === 'primary_compound') return goal === 'competition' ? 180 : 150;
  if (slotType === 'secondary_compound') return 120;
  if (slotType === 'finisher') return 45;
  return 75;
}

function setsForSlot(slotType) {
  if (slotType === 'primary_compound') return 4;
  if (slotType === 'secondary_compound') return 3;
  if (slotType === 'finisher') return 2;
  return 3;
}

function splitCatalog(days, goal) {
  if (days === 2) {
    return [
      { id: 'full_body', reason: '2-day frequency is best served by full-body coverage', days: ['Full Body A', 'Full Body B'] },
      { id: 'upper_lower', reason: 'upper/lower keeps sessions focused across 2 days', days: ['Upper', 'Lower'] },
      { id: 'push_pull_legs', reason: 'push/pull for two focused sessions', days: ['Push', 'Pull'] },
    ];
  }
  if (days === 3) {
    return [
      { id: 'push_pull_legs', reason: '3-day setup supports push/pull/legs balance', days: ['Push', 'Pull', 'Legs'] },
      { id: 'upper_lower_full', reason: 'upper/lower/full gives broad weekly coverage', days: ['Upper', 'Lower', 'Full Body'] },
      { id: 'full_body_3', reason: 'three full-body hits for frequency', days: ['Full Body A', 'Full Body B', 'Full Body C'] },
    ];
  }
  if (days === 4) {
    return [
      { id: 'upper_lower_x2', reason: '4 days aligns with upper/lower repeated exposures', days: ['Upper A', 'Lower A', 'Upper B', 'Lower B'] },
      { id: 'physique_4', reason: 'physique split supports higher local volume', days: ['Push', 'Pull', 'Legs', 'Push'] },
      { id: 'body_part_4', reason: 'body-part focus across four sessions', days: ['Chest', 'Back', 'Legs', 'Shoulders'] },
      { id: 'full_body_4', reason: 'four full-body variants', days: ['Full Body A', 'Full Body B', 'Full Body C', 'Full Body D'] },
    ];
  }
  if (days === 5) {
    return [
      { id: 'full_body_5', reason: 'five full-body sessions for high frequency', days: ['Full Body A', 'Full Body B', 'Full Body C', 'Full Body D', 'Full Body E'] },
      { id: 'ppl_ul', reason: '5-day setup fits PPL + upper/lower distribution', days: ['Push', 'Pull', 'Legs', 'Push', 'Pull'] },
      { id: 'bodybuilding_5', reason: 'bodybuilding split increases focus-area density', days: ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms'] },
      { id: 'upper_lower_5', reason: 'upper/lower with an extra upper day', days: ['Upper A', 'Lower A', 'Upper B', 'Lower B', 'Upper'] },
    ];
  }
  if (days === 6) {
    return [
      { id: 'full_body_6', reason: 'six full-body variants across the week', days: ['Full Body A', 'Full Body B', 'Full Body C', 'Full Body D', 'Full Body E', 'Full Body F'] },
      { id: 'ppl_x2', reason: 'classic 6-day push/pull/legs rotation', days: ['Push A', 'Pull A', 'Legs A', 'Push B', 'Pull B', 'Legs B'] },
      { id: 'upper_lower_6', reason: 'upper/lower three times through', days: ['Upper A', 'Lower A', 'Upper B', 'Lower B', 'Upper C', 'Lower C'] },
      { id: 'body_part_6', reason: 'body parts plus a full-body finish', days: ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Full Body'] },
    ];
  }
  return [{ id: 'full_body', reason: 'fallback full-body split', days: ['Full Body A', 'Full Body B', 'Full Body C'] }];
}

function structureMatchesOption(structureType, option) {
  const st = String(structureType || '').toLowerCase();
  if (!st) return true;
  const id = option.id.toLowerCase();
  const dayStr = (option.days || []).join(' ').toLowerCase();
  if (st === 'custom') return id === 'custom_week';
  if (st === 'full_body') {
    return id.includes('full') || dayStr.includes('full body');
  }
  if (st === 'upper_lower') {
    return id.includes('upper_lower') || (dayStr.includes('upper') && dayStr.includes('lower'));
  }
  if (st === 'push_pull_legs') {
    return (
      id.includes('ppl')
      || id.includes('push_pull')
      || id === 'physique_4'
      || (dayStr.includes('push') && dayStr.includes('pull'))
    );
  }
  if (st === 'body_part') {
    return id.includes('bodybuilding') || id.includes('body_part') || /chest|shoulder|arm/.test(dayStr);
  }
  return true;
}

function customWeekOption(days) {
  return {
    id: 'custom_week',
    reason: 'Custom labels — balanced lifts each day',
    days: Array.from({ length: days }, (_, i) => `Day ${i + 1}`),
  };
}

export function chooseSplitForContext(context = {}) {
  const days = toDays(context.daysPerWeek);
  const goal = String(context.goal || 'muscle').toLowerCase();
  const structureType = String(context.structureType || '').toLowerCase() || null;
  let options = splitCatalog(days, goal);

  if (structureType === 'custom') {
    const only = customWeekOption(days);
    return {
      splitId: only.id,
      splitReason: only.reason,
      dayTitles: only.days,
      alternatives: [],
    };
  }

  if (structureType) {
    const matched = options.filter((o) => structureMatchesOption(structureType, o));
    if (matched.length) {
      options = matched;
    }
  }

  const requested = String(context.splitType || '').toLowerCase();
  const chosen = options.find((o) => o.id === requested) || options[0];
  return {
    splitId: chosen.id,
    splitReason: chosen.reason,
    dayTitles: chosen.days.slice(0, days),
    alternatives: options.filter((o) => o.id !== chosen.id).map((o) => ({ id: o.id, reason: o.reason })),
  };
}

function daySlots(dayTitle, context = {}) {
  const t = String(dayTitle || '').toLowerCase();
  const prepSlot = context.isPrepOriented ? [{ slotType: 'pose', targetMuscles: ['core'], movementPattern: 'isolation', sessionWindow: 'finisher' }] : [];
  if (t.includes('chest')) {
    return [
      { slotType: 'primary_compound', movementPattern: 'push', targetMuscles: ['chest'], sessionWindow: 'main' },
      { slotType: 'secondary_compound', movementPattern: 'push', targetMuscles: ['chest', 'shoulders'], sessionWindow: 'secondary' },
      { slotType: 'isolation', movementPattern: 'isolation', targetMuscles: ['triceps', 'chest'], sessionWindow: 'finisher' },
      ...prepSlot,
    ];
  }
  if (t.includes('shoulder')) {
    return [
      { slotType: 'primary_compound', movementPattern: 'push', targetMuscles: ['shoulders'], sessionWindow: 'main' },
      { slotType: 'secondary_compound', movementPattern: 'pull', targetMuscles: ['rear_delts', 'back'], sessionWindow: 'secondary' },
      { slotType: 'isolation', movementPattern: 'isolation', targetMuscles: ['shoulders', 'triceps'], sessionWindow: 'finisher' },
      ...prepSlot,
    ];
  }
  if (t.includes('arm')) {
    return [
      { slotType: 'secondary_compound', movementPattern: 'pull', targetMuscles: ['biceps'], sessionWindow: 'main' },
      { slotType: 'isolation', movementPattern: 'isolation', targetMuscles: ['biceps', 'triceps'], sessionWindow: 'secondary' },
      { slotType: 'finisher', movementPattern: 'isolation', targetMuscles: ['arms'], sessionWindow: 'finisher' },
      ...prepSlot,
    ];
  }
  if (t.includes('push')) {
    return [
      { slotType: 'primary_compound', movementPattern: 'push', targetMuscles: ['chest', 'shoulders', 'triceps'], sessionWindow: 'main' },
      { slotType: 'secondary_compound', movementPattern: 'push', targetMuscles: ['chest', 'shoulders'], sessionWindow: 'secondary' },
      { slotType: 'isolation', movementPattern: 'isolation', targetMuscles: ['triceps', 'shoulders'], sessionWindow: 'finisher' },
      ...prepSlot,
    ];
  }
  if (t.includes('pull') || t.includes('back')) {
    return [
      { slotType: 'primary_compound', movementPattern: 'pull', targetMuscles: ['back'], sessionWindow: 'main' },
      { slotType: 'secondary_compound', movementPattern: 'pull', targetMuscles: ['back', 'biceps'], sessionWindow: 'secondary' },
      { slotType: 'isolation', movementPattern: 'isolation', targetMuscles: ['biceps', 'rear_delts'], sessionWindow: 'finisher' },
      ...prepSlot,
    ];
  }
  if (t.includes('leg') || t.includes('lower')) {
    return [
      { slotType: 'primary_compound', movementPattern: 'squat', targetMuscles: ['quads', 'glutes'], sessionWindow: 'main' },
      { slotType: 'secondary_compound', movementPattern: 'hinge', targetMuscles: ['hamstrings', 'glutes'], sessionWindow: 'secondary' },
      { slotType: 'isolation', movementPattern: 'isolation', targetMuscles: ['quads', 'hamstrings', 'calves'], sessionWindow: 'finisher' },
      ...prepSlot,
    ];
  }
  if (t.includes('upper')) {
    return [
      { slotType: 'primary_compound', movementPattern: 'push', targetMuscles: ['chest', 'shoulders'], sessionWindow: 'main' },
      { slotType: 'secondary_compound', movementPattern: 'pull', targetMuscles: ['back', 'biceps'], sessionWindow: 'secondary' },
      { slotType: 'accessory', movementPattern: 'isolation', targetMuscles: ['shoulders', 'arms'], sessionWindow: 'finisher' },
      ...prepSlot,
    ];
  }
  return [
    { slotType: 'primary_compound', movementPattern: 'squat', targetMuscles: ['quads', 'glutes'], sessionWindow: 'main' },
    { slotType: 'secondary_compound', movementPattern: 'push', targetMuscles: ['chest', 'shoulders'], sessionWindow: 'secondary' },
    { slotType: 'accessory', movementPattern: 'pull', targetMuscles: ['back', 'biceps'], sessionWindow: 'secondary' },
    { slotType: 'finisher', movementPattern: 'isolation', targetMuscles: ['core'], sessionWindow: 'finisher' },
    ...prepSlot,
  ];
}

export function buildProgramSkeleton(context = {}) {
  const split = chooseSplitForContext(context);
  return {
    split: split.splitId,
    splitReason: split.splitReason,
    explainability: [
      `Built for ${context.goal || 'muscle gain'} and ${toDays(context.daysPerWeek)} training days`,
      context.equipmentAccess?.length ? 'Matched to your available equipment' : 'Using broad gym defaults',
      (context.fatiguePreference || '') === 'low' ? 'Prioritised lower-fatigue options due to your current setup' : 'Balanced fatigue across the week',
    ],
    days: split.dayTitles.map((title, idx) => ({
      dayNumber: idx + 1,
      title,
      slots: daySlots(title, context),
    })),
  };
}

export function fillProgramWithExercises(programSkeleton, context = {}) {
  const candidates = Array.isArray(context.exerciseCandidates) ? context.exerciseCandidates : [];
  const used = new Set();
  const days = (programSkeleton?.days || []).map((day) => {
    const exercises = [];
    for (const slot of day.slots || []) {
      const ranked = rankExercisesForSlot(candidates, {
        ...context,
        slot,
        sessionWindow: slot.sessionWindow,
      });
      const pick = ranked.find((r) => !used.has(r.exercise.id)) || ranked[0];
      if (!pick) continue;
      used.add(pick.exercise.id);
      exercises.push({
        slotType: slot.slotType,
        exerciseId: pick.exercise.id || null,
        name: pick.exercise.display_name || pick.exercise.name,
        sets: setsForSlot(slot.slotType),
        reps: repRangeForGoal(context.goal, slot.slotType),
        restSeconds: restForSlot(slot.slotType, context.goal),
        reason: pick.reasonSummary,
        score: pick.totalScore,
      });
    }
    return {
      dayNumber: day.dayNumber,
      title: day.title,
      exercises,
    };
  });
  return {
    split: programSkeleton?.split,
    splitReason: programSkeleton?.splitReason,
    explainability: programSkeleton?.explainability || [],
    days,
    progressionDefaults: {
      method: 'double_progression',
      deloadEveryWeeks: 4,
      notes: 'Progress load after top rep range is hit with solid form.',
    },
  };
}

export function generateStarterProgram(context = {}) {
  if (!personalAutoProgramContextAllowed(context)) {
    if (import.meta.env.DEV) {
      console.warn('[autoProgramBuilder] Personal Basic: auto starter program is disabled (Enhanced only).');
    }
    return null;
  }
  const skeleton = buildProgramSkeleton(context);
  return fillProgramWithExercises(skeleton, context);
}

