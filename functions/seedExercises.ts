import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const EXERCISES_DATA = {
  chest: [
    { name: 'Barbell Bench Press', equipment: 'barbell' },
    { name: 'Dumbbell Bench Press', equipment: 'dumbbell' },
    { name: 'Incline Barbell Bench Press', equipment: 'barbell' },
    { name: 'Incline Dumbbell Press', equipment: 'dumbbell' },
    { name: 'Decline Push-ups', equipment: 'bodyweight' },
    { name: 'Cable Flyes', equipment: 'cable' },
    { name: 'Machine Chest Press', equipment: 'machine' },
    { name: 'Push-ups', equipment: 'bodyweight' },
    { name: 'Dumbbell Pullovers', equipment: 'dumbbell' },
    { name: 'Chest Dips', equipment: 'bodyweight' },
    { name: 'Smith Machine Bench Press', equipment: 'machine' },
    { name: 'Plate Loaded Chest Press', equipment: 'machine' },
    { name: 'Kettlebell Floor Press', equipment: 'kettlebell' },
    { name: 'Resistance Band Chest Press', equipment: 'bands' },
    { name: 'Landmine Press', equipment: 'barbell' }
  ],
  back: [
    { name: 'Barbell Deadlift', equipment: 'barbell' },
    { name: 'Barbell Bent-Over Row', equipment: 'barbell' },
    { name: 'Dumbbell Rows', equipment: 'dumbbell' },
    { name: 'Pull-ups', equipment: 'bodyweight' },
    { name: 'Lat Pulldowns', equipment: 'cable' },
    { name: 'Seated Cable Row', equipment: 'cable' },
    { name: 'Machine Row', equipment: 'machine' },
    { name: 'T-Bar Row', equipment: 'barbell' },
    { name: 'Chest-Supported Row', equipment: 'machine' },
    { name: 'Inverted Rows', equipment: 'bodyweight' },
    { name: 'Single-Arm Dumbbell Row', equipment: 'dumbbell' },
    { name: 'Pendulum Row', equipment: 'machine' },
    { name: 'Resistance Band Pull-aparts', equipment: 'bands' },
    { name: 'Hyperextensions', equipment: 'machine' },
    { name: 'Good Mornings', equipment: 'barbell' },
    { name: 'Seal Rows', equipment: 'dumbbell' }
  ],
  shoulders: [
    { name: 'Barbell Overhead Press', equipment: 'barbell' },
    { name: 'Dumbbell Shoulder Press', equipment: 'dumbbell' },
    { name: 'Machine Shoulder Press', equipment: 'machine' },
    { name: 'Lateral Raises', equipment: 'dumbbell' },
    { name: 'Cable Lateral Raises', equipment: 'cable' },
    { name: 'Reverse Flyes', equipment: 'dumbbell' },
    { name: 'Upright Rows', equipment: 'barbell' },
    { name: 'Shrugs', equipment: 'dumbbell' },
    { name: 'Barbell Shrugs', equipment: 'barbell' },
    { name: 'Machine Lateral Raises', equipment: 'machine' },
    { name: 'Pike Push-ups', equipment: 'bodyweight' },
    { name: 'Plate-Loaded Shoulder Press', equipment: 'machine' },
    { name: 'Arnold Press', equipment: 'dumbbell' },
    { name: 'Cable Reverse Flyes', equipment: 'cable' },
    { name: 'Kettlebell Shoulder Press', equipment: 'kettlebell' }
  ],
  arms: [
    { name: 'Barbell Curls', equipment: 'barbell' },
    { name: 'Dumbbell Curls', equipment: 'dumbbell' },
    { name: 'Tricep Dips', equipment: 'bodyweight' },
    { name: 'Tricep Rope Pushdowns', equipment: 'cable' },
    { name: 'Overhead Tricep Extension', equipment: 'dumbbell' },
    { name: 'Ez-Bar Curls', equipment: 'barbell' },
    { name: 'Cable Curls', equipment: 'cable' },
    { name: 'Preacher Curls', equipment: 'barbell' },
    { name: 'Machine Bicep Curl', equipment: 'machine' },
    { name: 'Close-Grip Bench Press', equipment: 'barbell' },
    { name: 'Skull Crushers', equipment: 'dumbbell' },
    { name: 'Hammer Curls', equipment: 'dumbbell' },
    { name: 'Reverse Curls', equipment: 'barbell' },
    { name: 'Machine Tricep Press', equipment: 'machine' },
    { name: 'Concentration Curls', equipment: 'dumbbell' },
    { name: 'Kickbacks', equipment: 'dumbbell' }
  ],
  legs: [
    { name: 'Barbell Back Squat', equipment: 'barbell' },
    { name: 'Leg Press', equipment: 'machine' },
    { name: 'Barbell Deadlift', equipment: 'barbell' },
    { name: 'Leg Curls', equipment: 'machine' },
    { name: 'Leg Extensions', equipment: 'machine' },
    { name: 'Bulgarian Split Squats', equipment: 'dumbbell' },
    { name: 'Lunges', equipment: 'dumbbell' },
    { name: 'Hack Squat', equipment: 'machine' },
    { name: 'Walking Lunges', equipment: 'dumbbell' },
    { name: 'Goblet Squats', equipment: 'kettlebell' },
    { name: 'Sissy Squats', equipment: 'bodyweight' },
    { name: 'Calf Raises', equipment: 'barbell' },
    { name: 'Machine Calf Raises', equipment: 'machine' },
    { name: 'Lever Squat', equipment: 'machine' },
    { name: 'Smith Machine Squat', equipment: 'machine' },
    { name: 'Pendulum Squat', equipment: 'machine' },
    { name: 'Dumbbell Squats', equipment: 'dumbbell' },
    { name: 'Jump Squats', equipment: 'bodyweight' }
  ],
  core: [
    { name: 'Barbell Deadlift', equipment: 'barbell' },
    { name: 'Planks', equipment: 'bodyweight' },
    { name: 'Cable Crunches', equipment: 'cable' },
    { name: 'Ab Wheel Rollouts', equipment: 'other' },
    { name: 'Decline Sit-ups', equipment: 'machine' },
    { name: 'Hanging Leg Raises', equipment: 'bodyweight' },
    { name: 'Machine Crunches', equipment: 'machine' },
    { name: 'Russian Twists', equipment: 'dumbbell' },
    { name: 'Landmine Rotations', equipment: 'barbell' },
    { name: 'Pallof Press', equipment: 'cable' },
    { name: 'Bicycle Crunches', equipment: 'bodyweight' },
    { name: 'Dead Bugs', equipment: 'bodyweight' },
    { name: 'Weighted Planks', equipment: 'other' },
    { name: 'Dragon Flags', equipment: 'bodyweight' }
  ],
  full_body: [
    { name: 'Barbell Deadlift', equipment: 'barbell' },
    { name: 'Barbell Back Squat', equipment: 'barbell' },
    { name: 'Barbell Bench Press', equipment: 'barbell' },
    { name: 'Barbell Overhead Press', equipment: 'barbell' },
    { name: 'Barbell Bent-Over Row', equipment: 'barbell' },
    { name: 'Dumbbell Thrusters', equipment: 'dumbbell' },
    { name: 'Kettlebell Swings', equipment: 'kettlebell' },
    { name: 'Burpees', equipment: 'bodyweight' },
    { name: 'Mountain Climbers', equipment: 'bodyweight' },
    { name: 'Box Jumps', equipment: 'other' }
  ]
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get existing exercises
    const existing = await base44.asServiceRole.entities.Exercise.list('-created_date', 500);
    const existingNames = new Set(existing.map(e => e.name.toLowerCase()));

    let seeded = 0;
    for (const [category, exercises] of Object.entries(EXERCISES_DATA)) {
      for (const exercise of exercises) {
        if (!existingNames.has(exercise.name.toLowerCase())) {
          await base44.asServiceRole.entities.Exercise.create({
            name: exercise.name,
            category: category,
            equipment: exercise.equipment
          });
          seeded++;
        }
      }
    }

    return Response.json({ 
      success: true, 
      message: `Seeded ${seeded} new exercises`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});