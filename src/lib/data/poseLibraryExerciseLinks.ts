/**
 * Per-pose exercise recommendations. Exercise IDs must exist in
 * `src/data/exercises/exerciseLibrary.js` (+ extended).
 * Merged onto poses in `poseLibraryData.ts`.
 */
import type { PoseExerciseLink } from '@/lib/models/poseLibrary';

const P = 'primary' as const;
const S = 'secondary' as const;

function L(exerciseId: string, reason: string, priority: 'primary' | 'secondary'): PoseExerciseLink {
  return { exerciseId, reason, priority };
}

const LINKS_FDB: PoseExerciseLink[] = [
  L('ex-barbell-curl', 'Builds bicep peak visible in front double biceps.', P),
  L('ex-preacher', 'Adds lower bicep fullness for a complete arm front.', P),
  L('ex-hammer-curl', 'Thickens brachialis for arm width from the front.', P),
  L('ex-incline-curl', 'Long-head emphasis that shows when arms are raised.', S),
  L('ex-db-curl', 'Unilateral balance so both arms match on stage.', S),
  L('ex-cable-curl', 'Constant tension for posing-endurance in the curl.', S),
  L('ex-pulldown', 'Supports lat flare without stealing bicep height.', S),
  L('ex-front-raise', 'Front delt finish so the frame stays wide with arms up.', S),
];

const LINKS_SIDE_CHEST: PoseExerciseLink[] = [
  L('ex-dips', 'Chest thickness and triceps support for the side chest wedge.', P),
  L('ex-incline-db', 'Upper chest fill visible in profile.', P),
  L('ex-cable-fly', 'Chest isolation and squeeze for the working pec.', P),
  L('ex-db-fly', 'Stretch and contraction for chest roundness from the side.', S),
  L('ex-leg-extension', 'Quad detail on the front leg in side poses.', S),
  L('ex-calf-raise', 'Calf completion on the display leg.', S),
  L('ex-row-db', 'Upper-back tightness so the chest can project forward.', S),
  L('ex-pushup', 'Chest endurance for holding the side line.', S),
];

const LINKS_BACK_LAT: PoseExerciseLink[] = [
  L('ex-pulldown', 'Primary lat width for spreading the back.', P),
  L('ex-pullup', 'Full-range lat engagement and control.', P),
  L('ex-straight-arm-pulldown', 'Teaches lat spread mechanics without heavy elbow bend.', P),
  L('ex-cable-row', 'Mid-back thickness that complements width.', S),
  L('ex-wide-pulldown', 'Emphasises outer lat sweep for the spread.', S),
  L('ex-deadlift', 'Erector and posterior chain density for a complete rear shot.', S),
  L('ex-rdl', 'Hamstring tie-in quality under the spread.', S),
];

const LINKS_FRONT_LAT: PoseExerciseLink[] = [
  L('ex-pulldown', 'Lat width you push forward in front lat spread.', P),
  L('ex-straight-arm-pulldown', 'Isolation for “push the lats out” patterning.', P),
  L('ex-cable-row', 'Rear delt and mid-back thickness behind the spread.', P),
  L('ex-pullup', 'Strength base for holding a wide front spread.', S),
  L('ex-hanging-leg', 'Bracing skill so abs stay tight while lats flare.', S),
  L('ex-plank', 'Anti-extension control for waist tightness.', S),
  L('ex-db-ohp', 'Delts that cap the V without collapsing posture.', S),
];

const LINKS_SIDE_TRI: PoseExerciseLink[] = [
  L('ex-tricep-pushdown', 'Tricep mass and lateral head detail for the display arm.', P),
  L('ex-skull-crusher', 'Long-head triceps for a full lockout line.', P),
  L('ex-overhead-ext', 'Overhead angle strength for extended arm poses.', P),
  L('ex-kickback', 'Peak contraction practice for the rear arm line.', S),
  L('ex-close-grip-bp', 'Heavy triceps loading for density.', S),
  L('ex-dips', 'Chest and triceps thickness in the same side line.', S),
  L('ex-leg-extension', 'Quad balance on the front leg.', S),
  L('ex-calf-raise', 'Lower-leg finish in profile.', S),
];

const LINKS_MOST_MUSCULAR: PoseExerciseLink[] = [
  L('ex-bp', 'Overall chest and front delt mass for the crush.', P),
  L('ex-close-grip-bp', 'Triceps and inner chest density for MM variants.', P),
  L('ex-shrug', 'Trap height without losing neck position.', P),
  L('ex-db-ohp', 'Shoulder cap that reads under full tension.', S),
  L('ex-row-bb', 'Upper-back thickness so the squeeze looks 3D.', S),
  L('ex-squat', 'Leg base so the pose does not collapse at the knees.', S),
  L('ex-deadlift', 'Total-body tension habit for “everything on”.', S),
  L('ex-tricep-pushdown', 'Arm detail when hands press together.', S),
];

const LINKS_BACK_DOUBLE_BICEP: PoseExerciseLink[] = [
  L('ex-barbell-curl', 'Matching bicep peaks with back to judges.', P),
  L('ex-hammer-curl', 'Brachialis width for rear double arm line.', P),
  L('ex-pulldown', 'Lat width behind the arms.', P),
  L('ex-pullup', 'Weighted progression for lat density.', S),
  L('ex-rdl-ham', 'Hamstring tie-in visible in rear shots.', S),
  L('ex-leg-curl', 'Hamstring separation for rear leg detail.', S),
  L('ex-row-db', 'Rhomboid control so arms stay symmetrical.', S),
  L('ex-rear-delt', 'Rear delt balance so lats can spread cleanly.', S),
];

const LINKS_ABS_THIGH: PoseExerciseLink[] = [
  L('ex-hanging-leg', 'Ab strength and control for abdominal display.', P),
  L('ex-crunch', 'Rectus work for crisp ab lines.', P),
  L('ex-leg-extension', 'Quad sweep on the forward leg.', P),
  L('ex-plank', 'Bracing pattern for vacuum-style control.', S),
  L('ex-pallof', 'Anti-rotation waist tightness.', S),
  L('ex-bicycle', 'Oblique detail without losing the front line.', S),
  L('ex-squat', 'Quad mass that fills the pose when flexed.', S),
  L('ex-lunge', 'Single-leg quad peaking practice.', S),
];

const LINKS_QUARTER_TURN_BB: PoseExerciseLink[] = [
  L('ex-lateral-raise', 'Shoulder cap for relaxed-quarter “V”.', P),
  L('ex-pulldown', 'Light lat engagement cues for quarter front.', P),
  L('ex-plank', 'Stacked torso and ribcage control.', P),
  L('ex-squat', 'Quad baseline so legs look full but not locked.', S),
  L('ex-ohp', 'Vertical press strength for upright carriage.', S),
  L('ex-calf-raise', 'Lower-leg polish in heels-together lines.', S),
  L('ex-face-pull', 'Upper-back posture for quarter back.', S),
  L('ex-rdl', 'Hamstring tone for rear-quarter leg line.', S),
];

const LINKS_PHYSIQUE_FRONT: PoseExerciseLink[] = [
  L('ex-lateral-raise', 'Shoulder width for the relaxed X-frame.', P),
  L('ex-cable-lateral', 'Cable constant tension for capped delts.', P),
  L('ex-plank', 'Waist control without bodybuilding flex.', P),
  L('ex-db-ohp', 'Pressing strength for confident relaxed shoulders.', S),
  L('ex-cable-fly', 'Light chest shape under board shorts.', S),
  L('ex-hip-thrust', 'Glute tone that supports stance without over-flex.', S),
  L('ex-leg-press', 'Quad baseline for athletic legs.', S),
  L('ex-pallof', 'Anti-twist control for subtle twists.', S),
];

const LINKS_PHYSIQUE_BACK: PoseExerciseLink[] = [
  L('ex-pulldown', 'Controlled lat width without a full spread.', P),
  L('ex-cable-row', 'Mid-back polish for rear relaxed presentation.', P),
  L('ex-rear-delt', 'Rear delt detail in soft back poses.', P),
  L('ex-face-pull', 'Posture and external rotation for clean rear line.', S),
  L('ex-rdl', 'Hamstring tone for rear leg separation.', S),
  L('ex-shrug', 'Trap height kept subtle for Physique back.', S),
  L('ex-hyperextension', 'Lower-back endurance for tall rear stance.', S),
];

const LINKS_BIKINI_FRONT: PoseExerciseLink[] = [
  L('ex-hip-thrust', 'Glute roundness that supports front hip shift.', P),
  L('ex-cable-kickback', 'Glute isolation for shape without bulk.', P),
  L('ex-plank', 'Waist control and tall posture.', P),
  L('ex-pallof', 'Oblique stability for twists and hand-on-hip lines.', S),
  L('ex-lunge', 'Leg shape and walking confidence carryover.', S),
  L('ex-lateral-raise', 'Delts that frame the waist in presentation.', S),
  L('ex-step-up', 'Single-leg stability for poised stance.', S),
  L('ex-bird-dog', 'Long-spine control for elegant front posture.', S),
];

const LINKS_BIKINI_BACK: PoseExerciseLink[] = [
  L('ex-hip-thrust', 'Glute lift for back-pose shape.', P),
  L('ex-glute-bridge', 'Glute activation patterns for subtle rear squeeze.', P),
  L('ex-leg-curl', 'Hamstring line under the glutes.', P),
  L('ex-rdl-ham', 'Posterior chain tone for clean back shots.', S),
  L('ex-cable-kickback', 'Targeted glute roundness from the rear.', S),
  L('ex-back-extension', 'Lower-back endurance without over-arching.', S),
  L('ex-face-pull', 'Upper-back posture so shoulders stay down.', S),
  L('ex-single-leg-rdl', 'Single-leg hamstring balance for hip shifts.', S),
];

const LINKS_BIKINI_SIDE: PoseExerciseLink[] = [
  L('ex-plank', 'Long waist and core control in profile.', P),
  L('ex-pallof', 'Anti-rotation for clean S-curves.', P),
  L('ex-lateral-raise', 'Shoulder line that opens the silhouette.', P),
  L('ex-hip-thrust', 'Glute curve from the side.', S),
  L('ex-curtsy-lunge', 'Hip and glute shape in crossed lines.', S),
  L('ex-bird-dog', 'Spinal alignment for side posture.', S),
  L('ex-step-up', 'Single-leg stability for profile stance.', S),
  L('ex-cable-lateral', 'Delts that cap the hourglass.', S),
];

const LINKS_FIGURE_FRONT: PoseExerciseLink[] = [
  L('ex-db-ohp', 'Shoulder development with feminine lines.', P),
  L('ex-lateral-raise', 'Cap delts for front symmetry.', P),
  L('ex-incline-db', 'Upper chest for soft-power front.', P),
  L('ex-plank', 'Waist control between muscularity and flow.', S),
  L('ex-leg-extension', 'Quad detail when legs stay switched on.', S),
  L('ex-row-db', 'Back thickness without over-widening the waist.', S),
  L('ex-pulldown', 'Lat taper support for X-frame.', S),
  L('ex-hip-thrust', 'Glute tone appropriate to Figure.', S),
];

const LINKS_FIGURE_BACK: PoseExerciseLink[] = [
  L('ex-pulldown', 'Upper lat width with arms slightly raised.', P),
  L('ex-cable-row', 'Mid-back detail for rear Figure line.', P),
  L('ex-rear-delt', 'Rear delt balance for symmetrical rear arms.', P),
  L('ex-face-pull', 'Posture cues for tall Figure back.', S),
  L('ex-shrug', 'Controlled trap height for rear presentation.', S),
  L('ex-rdl', 'Hamstring quality under the glutes.', S),
  L('ex-leg-curl', 'Hamstring separation from the back.', S),
  L('ex-pullup', 'Strength base for holding rear width.', S),
];

const LINKS_FIGURE_SIDE: PoseExerciseLink[] = [
  L('ex-incline-db', 'Chest and shoulder thickness in profile.', P),
  L('ex-leg-extension', 'Quad sweep on the display leg.', P),
  L('ex-lateral-raise', 'Shoulder line for Figure side shots.', P),
  L('ex-cable-fly', 'Pec shape from the side.', S),
  L('ex-row-db', 'Upper-back stack for vertical line.', S),
  L('ex-calf-raise', 'Lower-leg finish in side stance.', S),
  L('ex-plank', 'Core control for long waist.', S),
  L('ex-lunge', 'Single-leg shape for side poses.', S),
];

const LINKS_WELLNESS_BACK: PoseExerciseLink[] = [
  L('ex-hip-thrust', 'Glute mass for Wellness back emphasis.', P),
  L('ex-leg-curl', 'Hamstring sweep visible from the rear.', P),
  L('ex-rdl-ham', 'Posterior chain tie-in for Wellness lines.', P),
  L('ex-glute-bridge', 'Glute activation volume for shape.', S),
  L('ex-cable-kickback', 'Glute detail without losing flow.', S),
  L('ex-bulgarian', 'Single-leg quad and glute balance.', S),
  L('ex-back-extension', 'Controlled lower-back endurance.', S),
  L('ex-curtsy-lunge', 'Glute medius emphasis for roundness.', S),
];

const LINKS_WELLNESS_FRONT: PoseExerciseLink[] = [
  L('ex-leg-press', 'Quad sweep for athletic Wellness front.', P),
  L('ex-leg-extension', 'Quad detail at controlled flex.', P),
  L('ex-hip-thrust', 'Glute support for fuller lower body.', P),
  L('ex-lunge', 'Leg shape and balance for stance.', S),
  L('ex-plank', 'Waist length and ribcage control.', S),
  L('ex-db-ohp', 'Shoulder cap for athletic upper body.', S),
  L('ex-lateral-raise', 'Delt width that balances strong legs.', S),
  L('ex-goblet', 'Core-upright squat pattern for front posture.', S),
];

const LINKS_WELLNESS_SIDE: PoseExerciseLink[] = [
  L('ex-hip-thrust', 'Glute and hamstring curve from the side.', P),
  L('ex-rdl-ham', 'Hamstring length for Wellness side line.', P),
  L('ex-leg-curl', 'Hamstring peak in profile.', P),
  L('ex-bulgarian', 'Glute emphasis in split stance.', S),
  L('ex-single-leg-rdl', 'Single-leg hamstring balance.', S),
  L('ex-plank', 'Long waist presentation.', S),
  L('ex-curtsy-lunge', 'Glute shape in crossed lines.', S),
  L('ex-step-up', 'Hip height and quad control.', S),
];

const LINKS_W_PHYSIQUE_FRONT: PoseExerciseLink[] = [
  L('ex-incline-db', 'Upper chest and delts for WP front.', P),
  L('ex-db-ohp', 'Shoulder density with feminine balance.', P),
  L('ex-lateral-raise', 'Delt caps for structured WP frame.', P),
  L('ex-pulldown', 'Lat taper without excessive waist.', S),
  L('ex-leg-extension', 'Quad detail when legs are displayed.', S),
  L('ex-plank', 'Ab control for WP conditioning.', S),
  L('ex-row-db', 'Back thickness for “muscular but feminine”.', S),
  L('ex-hip-thrust', 'Glute tone supporting leg line.', S),
];

const LINKS_W_PHYSIQUE_BACK: PoseExerciseLink[] = [
  L('ex-pulldown', 'Lat width for WP back lat emphasis.', P),
  L('ex-straight-arm-pulldown', 'Lat spread control pattern.', P),
  L('ex-cable-row', 'Mid-back detail behind the spread.', P),
  L('ex-barbell-curl', 'Rear arm peaks when rear double–style poses apply.', S),
  L('ex-rdl-ham', 'Hamstring quality under lats.', S),
  L('ex-rear-delt', 'Rear delt balance for clean back.', S),
  L('ex-pullup', 'Strength for holding rear width.', S),
  L('ex-leg-curl', 'Hamstring separation.', S),
];

const LINKS_WHEELCHAIR_FRONT: PoseExerciseLink[] = [
  L('ex-db-ohp', 'Shoulder strength for upright front symmetry.', P),
  L('ex-chest-press', 'Machine chest for balanced front mass.', P),
  L('ex-lateral-raise', 'Delt width visible from the front.', P),
  L('ex-pushup', 'Upper-body control where lower-body cues differ.', S),
  L('ex-face-pull', 'Rear shoulder health for posture.', S),
  L('ex-plank', 'Core bracing adapted to seated context.', S),
  L('ex-tricep-pushdown', 'Arm detail in front symmetry.', S),
  L('ex-cable-row', 'Mid-back activation for front stack.', S),
];

const LINKS_WHEELCHAIR_REAR: PoseExerciseLink[] = [
  L('ex-pulldown', 'Lat engagement for rear symmetry shots.', P),
  L('ex-cable-row', 'Rowing strength for rear upper body.', P),
  L('ex-rear-delt', 'Rear delt detail facing away.', P),
  L('ex-face-pull', 'External rotation and posture.', S),
  L('ex-shrug', 'Trap control in rear presentation.', S),
  L('ex-pullup', 'Assisted patterns if accessible for lat strength.', S),
  L('ex-deadlift', 'If accessible: posterior chain density.', S),
  L('ex-hyperextension', 'Lower-back endurance for rear hold.', S),
];

const LINKS_WHEELCHAIR_SIDE: PoseExerciseLink[] = [
  L('ex-db-ohp', 'Shoulder press for side profile stack.', P),
  L('ex-lateral-raise', 'Side delt line in profile.', P),
  L('ex-cable-row', 'One-arm row patterning for side thickness.', P),
  L('ex-tricep-pushdown', 'Arm detail on display side.', S),
  L('ex-incline-db', 'Chest from the side.', S),
  L('ex-plank', 'Core control for long side line.', S),
  L('ex-pallof', 'Anti-rotation for clean side symmetry.', S),
  L('ex-cable-lateral', 'Cable delt polish.', S),
];

const LINKS_WHEELCHAIR_MM: PoseExerciseLink[] = [
  L('ex-close-grip-bp', 'Chest and triceps crush for seated MM.', P),
  L('ex-db-ohp', 'Shoulder mass under tension.', P),
  L('ex-shrug', 'Trap engagement for MM variants.', P),
  L('ex-tricep-pushdown', 'Tricep detail when pressing down.', S),
  L('ex-chest-press', 'Machine chest for safe heavy loading.', S),
  L('ex-bp', 'Overall chest thickness.', S),
  L('ex-row-bb', 'Upper-back counterbalance to push patterns.', S),
  L('ex-skull-crusher', 'Tricep long-head density.', S),
];

const LINKS_FITNESS_QUARTER: PoseExerciseLink[] = [
  L('ex-plank', 'Core control for quarter turns in routine work.', P),
  L('ex-pallof', 'Anti-rotation for clean pivots.', P),
  L('ex-lateral-raise', 'Shoulder line for athletic quarter shots.', P),
  L('ex-mountain-climber', 'Conditioning for routine stamina.', S),
  L('ex-pushup', 'Upper-body endurance between elements.', S),
  L('ex-lunge', 'Single-leg stability for turns.', S),
  L('ex-turkish-get-up', 'Total-body control relevant to fitness routines.', S),
  L('ex-bicycle', 'Rotational core for tumbling prep.', S),
];

const LINKS_FITNESS_ROUTINE: PoseExerciseLink[] = [
  L('ex-pushup', 'Upper-body endurance for routine rounds.', P),
  L('ex-mountain-climber', 'Cardio and core for performance fitness.', P),
  L('ex-plank', 'Bracing for strength elements.', P),
  L('ex-turkish-get-up', 'Full-body coordination and stability.', P),
  L('ex-jump-rope', 'Footwork and rhythm between routine segments.', S),
  L('ex-burpee', 'Power endurance for routine density.', S),
  L('ex-bicycle', 'Rotational core for twists and holds.', S),
  L('ex-squat', 'Leg power for tumbling takeoffs.', S),
];

/** Map pose id → exercise links (every pose in the library should have an entry). */
export const POSE_EXERCISE_LINKS_BY_POSE_ID: Record<string, PoseExerciseLink[]> = {
  male_fdb: LINKS_FDB,
  male_side_chest: LINKS_SIDE_CHEST,
  male_back_lat: LINKS_BACK_LAT,
  male_front_lat: LINKS_FRONT_LAT,
  male_side_triceps: LINKS_SIDE_TRI,
  male_most_muscular: LINKS_MOST_MUSCULAR,
  female_bikini_front: LINKS_BIKINI_FRONT,
  female_bikini_back: LINKS_BIKINI_BACK,
  female_bikini_side: LINKS_BIKINI_SIDE,
  female_figure_front: LINKS_FIGURE_FRONT,
  female_wellness_back: LINKS_WELLNESS_BACK,
  female_wellness_front: LINKS_WELLNESS_FRONT,

  male_back_double_bicep: LINKS_BACK_DOUBLE_BICEP,
  male_abdominal_thigh: LINKS_ABS_THIGH,
  male_quarter_turn_front: LINKS_QUARTER_TURN_BB,
  male_quarter_turn_right: LINKS_QUARTER_TURN_BB,
  male_quarter_turn_back: LINKS_QUARTER_TURN_BB,
  male_quarter_turn_left: LINKS_QUARTER_TURN_BB,
  male_physique_front_pose: LINKS_PHYSIQUE_FRONT,
  male_physique_back_pose: LINKS_PHYSIQUE_BACK,

  female_figure_back: LINKS_FIGURE_BACK,
  female_figure_side: LINKS_FIGURE_SIDE,
  female_wellness_side: LINKS_WELLNESS_SIDE,
  female_physique_front: LINKS_W_PHYSIQUE_FRONT,
  female_physique_back: LINKS_W_PHYSIQUE_BACK,
  female_bodybuilding_fdb: LINKS_FDB,

  male_wheelchair_front_symmetry: LINKS_WHEELCHAIR_FRONT,
  male_wheelchair_rear_symmetry: LINKS_WHEELCHAIR_REAR,
  male_wheelchair_side_symmetry: LINKS_WHEELCHAIR_SIDE,
  male_wheelchair_most_muscular_seated: LINKS_WHEELCHAIR_MM,

  female_fitness_quarter_front: LINKS_FITNESS_QUARTER,
  female_fitness_quarter_right: LINKS_FITNESS_QUARTER,
  female_fitness_quarter_back: LINKS_FITNESS_QUARTER,
  female_fitness_quarter_left: LINKS_FITNESS_QUARTER,
  female_fitness_routine: LINKS_FITNESS_ROUTINE,

  female_womens_bb_quarter_front: LINKS_QUARTER_TURN_BB,
  female_womens_bb_quarter_right: LINKS_QUARTER_TURN_BB,
  female_womens_bb_quarter_back: LINKS_QUARTER_TURN_BB,
  female_womens_bb_quarter_left: LINKS_QUARTER_TURN_BB,
  female_womens_bb_front_lat: LINKS_FRONT_LAT,
  female_womens_bb_side_chest: LINKS_SIDE_CHEST,
  female_womens_bb_side_tricep: LINKS_SIDE_TRI,
  female_womens_bb_rear_double: LINKS_BACK_DOUBLE_BICEP,
  female_womens_bb_rear_lat: LINKS_BACK_LAT,
  female_womens_bb_abs_thigh: LINKS_ABS_THIGH,
  female_womens_bb_most_muscular: LINKS_MOST_MUSCULAR,
};
