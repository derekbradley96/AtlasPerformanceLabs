export const PROGRAM_TEMPLATES = [
  {
    id: 'template-3day-full-body',
    name: '3 Day Full Body',
    description: 'Three balanced full-body sessions with squat, hinge, push, pull, and core each day.',
    days: [
      {
        title: 'Full Body A',
        exercises: [
          { name: 'Barbell Back Squat', sets: 4, reps: '6-8', restSeconds: 120 },
          { name: 'Romanian Deadlift', sets: 3, reps: '8-10', restSeconds: 120 },
          { name: 'Barbell Bench Press', sets: 4, reps: '6-8', restSeconds: 120 },
          { name: 'Lat Pulldown', sets: 3, reps: '10-12', restSeconds: 90 },
          { name: 'Plank', sets: 3, reps: '45-60s', restSeconds: 60 },
        ],
      },
      {
        title: 'Full Body B',
        exercises: [
          { name: 'Goblet Squat', sets: 3, reps: '10-12', restSeconds: 90 },
          { name: 'Barbell Deadlift', sets: 3, reps: '5-6', restSeconds: 150 },
          { name: 'Overhead Press', sets: 4, reps: '6-8', restSeconds: 120 },
          { name: 'Cable Row', sets: 3, reps: '10-12', restSeconds: 90 },
          { name: 'Dead Bug', sets: 3, reps: '10-12', restSeconds: 60 },
        ],
      },
      {
        title: 'Full Body C',
        exercises: [
          { name: 'Leg Press', sets: 4, reps: '8-10', restSeconds: 120 },
          { name: 'Hip Thrust', sets: 3, reps: '8-12', restSeconds: 90 },
          { name: 'Incline Dumbbell Press', sets: 4, reps: '8-10', restSeconds: 90 },
          { name: 'Barbell Row', sets: 4, reps: '8-10', restSeconds: 90 },
          { name: 'Hanging Leg Raise', sets: 3, reps: '10-12', restSeconds: 60 },
        ],
      },
    ],
  },
  {
    id: 'template-4day-upper-lower',
    name: '4 Day Upper/Lower',
    description: 'Classic upper/lower split with chest, back, shoulders, arms, and lower-body focus.',
    days: [
      {
        title: 'Upper A',
        exercises: [
          { name: 'Barbell Bench Press', sets: 4, reps: '6-8', restSeconds: 120 },
          { name: 'Barbell Row', sets: 4, reps: '8-10', restSeconds: 90 },
          { name: 'Dumbbell Shoulder Press', sets: 3, reps: '8-12', restSeconds: 90 },
          { name: 'Barbell Curl', sets: 3, reps: '10-12', restSeconds: 75 },
          { name: 'Tricep Pushdown', sets: 3, reps: '10-12', restSeconds: 75 },
        ],
      },
      {
        title: 'Lower A',
        exercises: [
          { name: 'Barbell Back Squat', sets: 4, reps: '6-8', restSeconds: 120 },
          { name: 'Romanian Deadlift', sets: 4, reps: '8-10', restSeconds: 120 },
          { name: 'Hip Thrust', sets: 3, reps: '8-12', restSeconds: 90 },
          { name: 'Leg Curl', sets: 3, reps: '10-12', restSeconds: 75 },
          { name: 'Standing Calf Raise', sets: 4, reps: '12-15', restSeconds: 60 },
        ],
      },
      {
        title: 'Upper B',
        exercises: [
          { name: 'Incline Barbell Press', sets: 4, reps: '8-10', restSeconds: 90 },
          { name: 'Lat Pulldown', sets: 4, reps: '8-12', restSeconds: 90 },
          { name: 'Lateral Raise', sets: 3, reps: '12-15', restSeconds: 60 },
          { name: 'Hammer Curl', sets: 3, reps: '10-12', restSeconds: 75 },
          { name: 'Overhead Tricep Extension', sets: 3, reps: '10-12', restSeconds: 75 },
        ],
      },
      {
        title: 'Lower B',
        exercises: [
          { name: 'Front Squat', sets: 4, reps: '6-8', restSeconds: 120 },
          { name: 'Walking Lunge', sets: 3, reps: '10-12', restSeconds: 90 },
          { name: 'Glute Bridge', sets: 3, reps: '10-12', restSeconds: 90 },
          { name: 'Leg Extension', sets: 3, reps: '12-15', restSeconds: 75 },
          { name: 'Seated Calf Raise', sets: 4, reps: '12-15', restSeconds: 60 },
        ],
      },
    ],
  },
  {
    id: 'template-5day-bodybuilding',
    name: '5 Day Bodybuilding Split',
    description: 'High-volume hypertrophy split for chest, back, legs, shoulders, and arms.',
    days: [
      {
        title: 'Chest',
        exercises: [
          { name: 'Barbell Bench Press', sets: 4, reps: '8-12', restSeconds: 90 },
          { name: 'Incline Dumbbell Press', sets: 4, reps: '8-12', restSeconds: 90 },
          { name: 'Chest Press Machine', sets: 3, reps: '10-12', restSeconds: 75 },
          { name: 'Cable Fly', sets: 3, reps: '12-15', restSeconds: 60 },
          { name: 'Push-up', sets: 3, reps: '10-15', restSeconds: 60 },
        ],
      },
      {
        title: 'Back',
        exercises: [
          { name: 'Barbell Deadlift', sets: 3, reps: '8-10', restSeconds: 120 },
          { name: 'Barbell Row', sets: 4, reps: '8-12', restSeconds: 90 },
          { name: 'Lat Pulldown', sets: 4, reps: '8-12', restSeconds: 90 },
          { name: 'Cable Row', sets: 3, reps: '10-12', restSeconds: 75 },
          { name: 'Face Pull', sets: 3, reps: '12-15', restSeconds: 60 },
          { name: 'Straight-Arm Pulldown', sets: 3, reps: '12-15', restSeconds: 60 },
        ],
      },
      {
        title: 'Legs',
        exercises: [
          { name: 'Barbell Back Squat', sets: 4, reps: '8-12', restSeconds: 120 },
          { name: 'Leg Press', sets: 4, reps: '10-12', restSeconds: 90 },
          { name: 'Romanian Deadlift', sets: 4, reps: '8-12', restSeconds: 90 },
          { name: 'Leg Curl', sets: 3, reps: '10-12', restSeconds: 75 },
          { name: 'Leg Extension', sets: 3, reps: '12-15', restSeconds: 60 },
          { name: 'Standing Calf Raise', sets: 4, reps: '12-15', restSeconds: 60 },
        ],
      },
      {
        title: 'Shoulders',
        exercises: [
          { name: 'Overhead Press', sets: 4, reps: '8-12', restSeconds: 90 },
          { name: 'Dumbbell Shoulder Press', sets: 4, reps: '8-12', restSeconds: 90 },
          { name: 'Lateral Raise', sets: 4, reps: '12-15', restSeconds: 60 },
          { name: 'Rear Delt Fly', sets: 4, reps: '12-15', restSeconds: 60 },
          { name: 'Cable Lateral Raise', sets: 3, reps: '12-15', restSeconds: 60 },
        ],
      },
      {
        title: 'Arms',
        exercises: [
          { name: 'Barbell Curl', sets: 4, reps: '8-12', restSeconds: 75 },
          { name: 'Hammer Curl', sets: 3, reps: '10-12', restSeconds: 75 },
          { name: 'Preacher Curl', sets: 3, reps: '10-12', restSeconds: 75 },
          { name: 'Tricep Pushdown', sets: 4, reps: '10-12', restSeconds: 75 },
          { name: 'Skull Crusher', sets: 3, reps: '8-12', restSeconds: 75 },
          { name: 'Overhead Tricep Extension', sets: 3, reps: '10-12', restSeconds: 75 },
        ],
      },
    ],
  },
];

export function getProgramTemplateById(id) {
  return PROGRAM_TEMPLATES.find((t) => t.id === id) || null;
}
