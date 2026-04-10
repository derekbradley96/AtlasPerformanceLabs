const GOAL_PRESETS = {
  fat_loss: {
    defaultReps: '10-15',
    restSeconds: 60,
    focus: 'conditioning',
  },
  muscle: {
    defaultReps: '8-12',
    restSeconds: 90,
    focus: 'hypertrophy',
  },
  competition: {
    defaultReps: '6-10',
    restSeconds: 120,
    focus: 'strength',
  },
  general_fitness: {
    defaultReps: '10-12',
    restSeconds: 75,
    focus: 'general',
  },
};

/** @typedef {'full_body'|'upper_lower'|'push_pull_legs'|'body_part'|'custom'} WeekStructureType */

const SPLIT_LIBRARY = {
  full_body: ['Full Body A', 'Full Body B', 'Full Body C', 'Full Body D', 'Full Body E', 'Full Body F'],
  upper_lower: ['Upper A', 'Lower A', 'Upper B', 'Lower B', 'Upper C', 'Lower C'],
  push_pull_legs: ['Push', 'Pull', 'Legs', 'Upper', 'Lower'],
};

const BODY_PART_ORDER = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms'];

/**
 * Day titles for preview + quick-start generation (flexible days × structure).
 * @param {WeekStructureType|string} structureType
 * @param {number} daysPerWeek
 * @returns {string[]}
 */
export function getQuickStartWeekPreviewTitles(structureType, daysPerWeek) {
  const days = Math.max(2, Math.min(6, Number(daysPerWeek) || 3));
  const st = String(structureType || 'full_body').toLowerCase();

  if (st === 'custom') {
    return Array.from({ length: days }, (_, i) => `Day ${i + 1}`);
  }
  if (st === 'full_body') {
    return SPLIT_LIBRARY.full_body.slice(0, days);
  }
  if (st === 'upper_lower') {
    if (days === 2) return ['Upper', 'Lower'];
    if (days === 3) return ['Upper', 'Lower', 'Upper'];
    if (days === 4) return ['Upper A', 'Lower A', 'Upper B', 'Lower B'];
    if (days === 5) return ['Upper A', 'Lower A', 'Upper B', 'Lower B', 'Upper'];
    return ['Upper A', 'Lower A', 'Upper B', 'Lower B', 'Upper C', 'Lower C'];
  }
  if (st === 'push_pull_legs') {
    if (days === 2) return ['Push', 'Pull'];
    if (days === 3) return ['Push', 'Pull', 'Legs'];
    if (days === 4) return ['Push', 'Pull', 'Legs', 'Push'];
    if (days === 5) return ['Push', 'Pull', 'Legs', 'Push', 'Pull'];
    return ['Push A', 'Pull A', 'Legs A', 'Push B', 'Pull B', 'Legs B'];
  }
  if (st === 'body_part') {
    if (days <= BODY_PART_ORDER.length) return BODY_PART_ORDER.slice(0, days);
    return [...BODY_PART_ORDER, 'Full Body'].slice(0, days);
  }
  return SPLIT_LIBRARY.full_body.slice(0, days);
}

const EXERCISE_BANK = {
  Full: ['Back Squat', 'Bench Press', 'Romanian Deadlift', 'Lat Pulldown', 'Cable Crunch'],
  Upper: ['Incline Dumbbell Press', 'Chest Supported Row', 'Seated Shoulder Press', 'Lateral Raise', 'Cable Curl'],
  Lower: ['Leg Press', 'Romanian Deadlift', 'Walking Lunges', 'Hamstring Curl', 'Standing Calf Raise'],
  Push: ['Barbell Bench Press', 'Incline Dumbbell Press', 'Seated Dumbbell Press', 'Cable Fly', 'Triceps Pressdown'],
  Pull: ['Pull-up', 'Barbell Row', 'Single Arm Row', 'Face Pull', 'EZ Bar Curl'],
  Legs: ['Back Squat', 'Leg Press', 'Romanian Deadlift', 'Leg Extension', 'Seated Leg Curl'],
  Chest: ['Barbell Bench Press', 'Incline Dumbbell Press', 'Cable Fly', 'Machine Chest Press', 'Triceps Pressdown'],
  Back: ['Pull-up', 'Barbell Row', 'Lat Pulldown', 'Chest Supported Row', 'EZ Bar Curl'],
  Shoulders: ['Overhead Press', 'Lateral Raise', 'Rear Delt Fly', 'Upright Row', 'Face Pull'],
  Arms: ['EZ Bar Curl', 'Cable Curl', 'Triceps Pressdown', 'Skullcrusher', 'Hammer Curl'],
};

function getUpperLowerFourDayPreset(goal) {
  const isStrengthBias = goal === 'competition';
  if (isStrengthBias) {
    return [
      {
        title: 'Upper A',
        bias: 'strength',
        exercises: [
          { name: 'Barbell Bench Press', sets: 5, reps: '3-5', restSeconds: 180, notes: 'Primary strength lift' },
          { name: 'Weighted Pull-up', sets: 4, reps: '4-6', restSeconds: 150, notes: '' },
          { name: 'Overhead Press', sets: 4, reps: '4-6', restSeconds: 150, notes: '' },
          { name: 'Chest Supported Row', sets: 4, reps: '6-8', restSeconds: 120, notes: '' },
          { name: 'Cable Lateral Raise', sets: 3, reps: '10-12', restSeconds: 75, notes: '' },
        ],
      },
      {
        title: 'Lower A',
        bias: 'strength',
        exercises: [
          { name: 'Back Squat', sets: 5, reps: '3-5', restSeconds: 180, notes: 'Primary strength lift' },
          { name: 'Romanian Deadlift', sets: 4, reps: '5-7', restSeconds: 150, notes: '' },
          { name: 'Leg Press', sets: 3, reps: '8-10', restSeconds: 120, notes: '' },
          { name: 'Seated Leg Curl', sets: 3, reps: '8-10', restSeconds: 90, notes: '' },
          { name: 'Standing Calf Raise', sets: 4, reps: '10-12', restSeconds: 75, notes: '' },
        ],
      },
      {
        title: 'Upper B',
        bias: 'hypertrophy',
        exercises: [
          { name: 'Incline Dumbbell Press', sets: 4, reps: '8-12', restSeconds: 105, notes: 'Hypertrophy focus' },
          { name: 'Single Arm Cable Row', sets: 4, reps: '8-12', restSeconds: 105, notes: '' },
          { name: 'Machine Shoulder Press', sets: 3, reps: '10-12', restSeconds: 90, notes: '' },
          { name: 'Cable Fly', sets: 3, reps: '12-15', restSeconds: 75, notes: '' },
          { name: 'EZ Bar Curl', sets: 3, reps: '10-12', restSeconds: 75, notes: '' },
        ],
      },
      {
        title: 'Lower B',
        bias: 'hypertrophy',
        exercises: [
          { name: 'Hack Squat', sets: 4, reps: '8-12', restSeconds: 120, notes: 'Hypertrophy focus' },
          { name: 'DB Romanian Deadlift', sets: 4, reps: '8-12', restSeconds: 105, notes: '' },
          { name: 'Walking Lunges', sets: 3, reps: '10-12 / leg', restSeconds: 90, notes: '' },
          { name: 'Leg Extension', sets: 3, reps: '12-15', restSeconds: 75, notes: '' },
          { name: 'Seated Calf Raise', sets: 4, reps: '12-15', restSeconds: 60, notes: '' },
        ],
      },
    ];
  }

  return [
    {
      title: 'Upper A',
      bias: 'hypertrophy',
      exercises: [
        { name: 'Incline Dumbbell Press', sets: 4, reps: '8-12', restSeconds: 105, notes: 'Primary hypertrophy lift' },
        { name: 'Chest Supported Row', sets: 4, reps: '8-12', restSeconds: 105, notes: '' },
        { name: 'Seated Shoulder Press', sets: 3, reps: '10-12', restSeconds: 90, notes: '' },
        { name: 'Cable Lateral Raise', sets: 3, reps: '12-15', restSeconds: 75, notes: '' },
        { name: 'Cable Curl', sets: 3, reps: '10-12', restSeconds: 75, notes: '' },
      ],
    },
    {
      title: 'Lower A',
      bias: 'hypertrophy',
      exercises: [
        { name: 'Leg Press', sets: 4, reps: '10-12', restSeconds: 120, notes: 'Primary hypertrophy lift' },
        { name: 'Romanian Deadlift', sets: 4, reps: '8-10', restSeconds: 120, notes: '' },
        { name: 'Walking Lunges', sets: 3, reps: '10-12 / leg', restSeconds: 90, notes: '' },
        { name: 'Seated Leg Curl', sets: 3, reps: '10-12', restSeconds: 90, notes: '' },
        { name: 'Standing Calf Raise', sets: 4, reps: '12-15', restSeconds: 60, notes: '' },
      ],
    },
    {
      title: 'Upper B',
      bias: 'strength',
      exercises: [
        { name: 'Barbell Bench Press', sets: 5, reps: '4-6', restSeconds: 180, notes: 'Strength focus' },
        { name: 'Weighted Pull-up', sets: 4, reps: '4-6', restSeconds: 150, notes: '' },
        { name: 'Overhead Press', sets: 4, reps: '5-7', restSeconds: 120, notes: '' },
        { name: 'Single Arm Row', sets: 3, reps: '6-8', restSeconds: 120, notes: '' },
        { name: 'Triceps Pressdown', sets: 3, reps: '10-12', restSeconds: 75, notes: '' },
      ],
    },
    {
      title: 'Lower B',
      bias: 'strength',
      exercises: [
        { name: 'Back Squat', sets: 5, reps: '4-6', restSeconds: 180, notes: 'Strength focus' },
        { name: 'Romanian Deadlift', sets: 4, reps: '5-7', restSeconds: 150, notes: '' },
        { name: 'Hack Squat', sets: 3, reps: '6-8', restSeconds: 120, notes: '' },
        { name: 'Seated Leg Curl', sets: 3, reps: '8-10', restSeconds: 90, notes: '' },
        { name: 'Seated Calf Raise', sets: 4, reps: '10-12', restSeconds: 60, notes: '' },
      ],
    },
  ];
}

export function getLockedUpperLowerTwoHypertrophyTwoStrength() {
  return [
    {
      dayName: 'Upper A',
      emphasis: 'hypertrophy',
      exercises: [
        { name: 'Incline Dumbbell Press', sets: 4, reps: '8-12', restSeconds: 105, notes: 'Hypertrophy primary' },
        { name: 'Chest Supported Row', sets: 4, reps: '8-12', restSeconds: 105, notes: '' },
        { name: 'Seated Shoulder Press', sets: 3, reps: '10-12', restSeconds: 90, notes: '' },
        { name: 'Cable Lateral Raise', sets: 3, reps: '12-15', restSeconds: 75, notes: '' },
        { name: 'Cable Curl', sets: 3, reps: '10-12', restSeconds: 75, notes: '' },
      ],
    },
    {
      dayName: 'Lower A',
      emphasis: 'hypertrophy',
      exercises: [
        { name: 'Leg Press', sets: 4, reps: '10-12', restSeconds: 120, notes: 'Hypertrophy primary' },
        { name: 'Romanian Deadlift', sets: 4, reps: '8-10', restSeconds: 120, notes: '' },
        { name: 'Walking Lunges', sets: 3, reps: '10-12 / leg', restSeconds: 90, notes: '' },
        { name: 'Seated Leg Curl', sets: 3, reps: '10-12', restSeconds: 90, notes: '' },
        { name: 'Standing Calf Raise', sets: 4, reps: '12-15', restSeconds: 60, notes: '' },
      ],
    },
    {
      dayName: 'Upper B',
      emphasis: 'strength',
      exercises: [
        { name: 'Barbell Bench Press', sets: 5, reps: '4-6', restSeconds: 180, notes: 'Strength primary' },
        { name: 'Weighted Pull-up', sets: 4, reps: '4-6', restSeconds: 150, notes: '' },
        { name: 'Overhead Press', sets: 4, reps: '5-7', restSeconds: 120, notes: '' },
        { name: 'Single Arm Row', sets: 3, reps: '6-8', restSeconds: 120, notes: '' },
        { name: 'Triceps Pressdown', sets: 3, reps: '10-12', restSeconds: 75, notes: '' },
      ],
    },
    {
      dayName: 'Lower B',
      emphasis: 'strength',
      exercises: [
        { name: 'Back Squat', sets: 5, reps: '4-6', restSeconds: 180, notes: 'Strength primary' },
        { name: 'Romanian Deadlift', sets: 4, reps: '5-7', restSeconds: 150, notes: '' },
        { name: 'Hack Squat', sets: 3, reps: '6-8', restSeconds: 120, notes: '' },
        { name: 'Seated Leg Curl', sets: 3, reps: '8-10', restSeconds: 90, notes: '' },
        { name: 'Seated Calf Raise', sets: 4, reps: '10-12', restSeconds: 60, notes: '' },
      ],
    },
  ];
}

export function suggestSplitType(daysPerWeek) {
  return suggestWeekStructureType(daysPerWeek);
}

/** Default week structure when training days change (balanced, not PPL-only). */
export function suggestWeekStructureType(daysPerWeek) {
  const days = Math.max(2, Math.min(6, Number(daysPerWeek) || 3));
  if (days <= 3) return 'full_body';
  if (days === 4) return 'upper_lower';
  if (days === 5) return 'body_part';
  return 'push_pull_legs';
}

function titleToExerciseGroup(dayTitle) {
  const t = dayTitle.toLowerCase();
  if (t.startsWith('day ')) return 'Full';
  if (t.includes('chest')) return 'Chest';
  if (t.includes('shoulder')) return 'Shoulders';
  if (t.includes('arm')) return 'Arms';
  if (t.includes('back')) return 'Back';
  if (t.includes('push')) return 'Push';
  if (t.includes('pull')) return 'Pull';
  if (t.includes('leg')) return 'Legs';
  if (t.includes('upper')) return 'Upper';
  if (t.includes('lower')) return 'Lower';
  return 'Full';
}

export function generateQuickStartWeek({ goal = 'muscle', daysPerWeek = 3, splitType, structureType }) {
  const normalizedGoal = GOAL_PRESETS[goal] ? goal : 'muscle';
  const days = Math.max(2, Math.min(6, Number(daysPerWeek) || 3));
  const rawStruct = structureType || splitType;
  const pickedStruct =
    ['full_body', 'upper_lower', 'push_pull_legs', 'body_part', 'custom'].includes(String(rawStruct))
      ? String(rawStruct)
      : suggestWeekStructureType(days);
  const preset = GOAL_PRESETS[normalizedGoal];
  const dayTitles = getQuickStartWeekPreviewTitles(pickedStruct, days);

  if (pickedStruct === 'upper_lower' && days === 4) {
    const tuned = getUpperLowerFourDayPreset(normalizedGoal);
    const generatedDays = tuned.map((day, dayIndex) => ({
      dayNumber: dayIndex + 1,
      title: day.title,
      estimatedMinutes: 40 + day.exercises.length * 5,
      exercises: day.exercises,
    }));
    return {
      goal: normalizedGoal,
      daysPerWeek: days,
      splitType: pickedStruct,
      structureType: pickedStruct,
      days: generatedDays,
      estimatedMinutes: generatedDays.reduce((sum, d) => sum + d.estimatedMinutes, 0),
    };
  }

  const generatedDays = dayTitles.map((dayTitle, dayIndex) => {
    const groupKey = titleToExerciseGroup(dayTitle);
    const baseExercises = EXERCISE_BANK[groupKey] || EXERCISE_BANK.Full;
    const exercises = baseExercises.slice(0, 5).map((name, idx) => ({
      name,
      sets: idx < 2 ? 4 : 3,
      reps: preset.defaultReps,
      restSeconds: preset.restSeconds,
      notes: idx === 0 ? `Primary ${preset.focus} lift` : '',
    }));
    return {
      dayNumber: dayIndex + 1,
      title: dayTitle,
      estimatedMinutes: 35 + exercises.length * 5,
      exercises,
    };
  });

  return {
    goal: normalizedGoal,
    daysPerWeek: days,
    splitType: pickedStruct,
    structureType: pickedStruct,
    days: generatedDays,
    estimatedMinutes: generatedDays.reduce((sum, d) => sum + d.estimatedMinutes, 0),
  };
}
