/**
 * Pose library: mandatory and presentation poses with hotspots, federation judgeNotes, and coach verbal cues.
 */
import type { Pose } from '@/lib/models/poseLibrary';
import { makeJudgeNotes, type JudgeNoteLines } from '@/lib/data/poseLibraryJudgeNotes';
import { EXTENDED_POSE_LIBRARY_DATA } from '@/lib/data/poseLibraryData.extended';
import { POSE_EXERCISE_LINKS_BY_POSE_ID } from '@/lib/data/poseLibraryExerciseLinks';

const maleDivisions = ['BODYBUILDING', 'CLASSIC', 'PHYSIQUE'] as const;
const femaleDivisionsBikini = ['BIKINI'] as const;
const femaleDivisionsFigure = ['FIGURE'] as const;
const femaleDivisionsWellness = ['WELLNESS'] as const;

const N = (lines: JudgeNoteLines) => makeJudgeNotes(lines);

const BB_FRONT: JudgeNoteLines = {
  uk: ['Front symmetry', 'Shoulder width and chest tie-in', 'Quad sweep and conditioning'],
  us: ['Muscularity and balance', 'Separation', 'Mandatory execution quality'],
  intl: ['Stage presence', 'Confidence', 'Clean transitions'],
  other: ['Rulebook criteria', 'Consistency', 'Sportsmanship'],
};

const BB_BACK: JudgeNoteLines = {
  uk: ['Back width and detail', 'Arm symmetry', 'Glute–ham tie-in'],
  us: ['Density through lats and lower back', 'Conditioning', 'Leg quality'],
  intl: ['Rear presentation', 'Control', 'Posing discipline'],
  other: ['Overall rear package', 'Criteria per org', 'Flow'],
};

const BB_SIDE: JudgeNoteLines = {
  uk: ['Side thickness', 'Chest or tricep emphasis', 'Leg line'],
  us: ['Muscle detail from profile', 'Conditioning', 'Shoulder tie-in'],
  intl: ['Angles to judges', 'Polish', 'Confidence'],
  other: ['Technical execution', 'Balance', 'Presentation'],
};

const BIKINI_NOTES: JudgeNoteLines = {
  uk: ['Shape and curves', 'Waist control', 'Presentation'],
  us: ['Marketability', 'Conditioning appropriate to bikini', 'Stage walk'],
  intl: ['Personality', 'Photogenic lines', 'Grooming'],
  other: ['Overall impression', 'Flow', 'Posing polish'],
};

const CORE_POSES: Record<string, Pose> = {
  male_fdb: {
    id: 'male_fdb',
    name: 'Front Double Bicep',
    sex: 'MALE',
    divisions: [...maleDivisions],
    isMandatory: true,
    svgAssetPath: 'male_fdb',
    description: 'Face the judges, arms bent, both biceps flexed, hands at shoulder height.',
    hotspots: [
      { id: 'arms', label: 'Arms', shape: 'rect', coords: [25, 15, 50, 35], cueTitle: 'Arm symmetry', cueBody: 'Keep both arms at the same height and angle. Squeeze the biceps evenly.' },
      { id: 'core', label: 'Core', shape: 'rect', coords: [30, 45, 40, 25], cueTitle: 'Abs tight', cueBody: 'Brace your core without sucking in too hard. Judges look for control.' },
    ],
    judgeNotes: N(BB_FRONT),
    commonMistakes: ['Uneven arm height', 'Flaring lats too much', 'Soft abs'],
    tips: ['Equal arm height', 'Slight vacuum', 'Full squeeze'],
    coachingScript:
      'Stand tall, feet shoulder width apart. Drive your heels into the floor to engage your quads. Bring both arms up to shoulder height simultaneously — no peeking one arm before the other. Squeeze the biceps hard. Slight vacuum without losing your core. Eyes up, chin slightly down. Hold it. Breathe through your nose.',
  },
  male_side_chest: {
    id: 'male_side_chest',
    name: 'Side Chest',
    sex: 'MALE',
    divisions: [...maleDivisions],
    isMandatory: true,
    svgAssetPath: 'male_side_chest',
    description: 'Turn 90° to the side, one arm bent, chest and leg on side flexed.',
    hotspots: [
      { id: 'chest', label: 'Chest', shape: 'circle', coords: [35, 30, 12], cueTitle: 'Chest fill', cueBody: 'Push the chest out toward the judges. Keep the shoulder rolled back.' },
      { id: 'leg', label: 'Leg', shape: 'rect', coords: [20, 55, 25, 35], cueTitle: 'Quad and calf', cueBody: 'Flex the quad and calf on the side facing the judges.' },
    ],
    judgeNotes: N(BB_SIDE),
    commonMistakes: ['Hiding chest', 'Bad leg angle', 'Relaxed leg'],
    tips: ['Chest up', 'Quad flexed', 'Calf flexed'],
    coachingScript:
      'Set your profile to the judges. Roll the front shoulder back and open the chest like you are trying to touch the far wall with your sternum. Anchor the back foot, flex the front quad and calf, and keep the waist long. Breathe shallow—show thickness without collapsing forward.',
  },
  male_back_lat: {
    id: 'male_back_lat',
    name: 'Back Lat Spread',
    sex: 'MALE',
    divisions: [...maleDivisions],
    isMandatory: true,
    svgAssetPath: 'male_back_lat',
    description: 'Back to judges, arms at sides or slightly forward, lats spread wide.',
    hotspots: [
      { id: 'lats', label: 'Lats', shape: 'rect', coords: [20, 25, 60, 35], cueTitle: 'Lat spread', cueBody: 'Push lats out and forward. Think of spreading a cape.' },
      { id: 'glutes', label: 'Glutes', shape: 'rect', coords: [35, 65, 30, 20], cueTitle: 'Glutes and hamstrings', cueBody: 'Slight flex in glutes and hams. Don’t over-flex.' },
    ],
    judgeNotes: N(BB_BACK),
    commonMistakes: ['Shrugging', 'Bent arms', 'Poor leg positioning'],
    tips: ['Elbows slightly forward', 'Squeeze shoulder blades', 'Width'],
    coachingScript:
      'Back square to the judges. Long neck, weight through the heels. Elbows drift slightly forward as you widen the lats—don’t shrug into your ears. Set the glutes and hamstrings with a quiet flex so the lower body finishes the V-taper. Hold and breathe small.',
  },
  male_front_lat: {
    id: 'male_front_lat',
    name: 'Front Lat Spread',
    sex: 'MALE',
    divisions: [...maleDivisions],
    isMandatory: true,
    svgAssetPath: 'male_front_lat',
    description: 'Face judges, arms slightly bent at sides, push lats forward and out.',
    hotspots: [
      { id: 'lats', label: 'Lats', shape: 'rect', coords: [22, 28, 56, 32], cueTitle: 'Lat width', cueBody: 'Spread lats to show V-taper. Control waist.' },
      { id: 'waist', label: 'Waist', shape: 'rect', coords: [38, 48, 24, 22], cueTitle: 'Waist', cueBody: 'Keep waist tight and controlled.' },
    ],
    judgeNotes: N(BB_FRONT),
    commonMistakes: ['Rolling shoulders forward', 'Bending elbows too much'],
    tips: ['Push lats out', 'Chest up', 'Abs tight'],
    coachingScript:
      'Face front with hands just off the hips. Think “wide elbows, wide lats” while keeping the chest proud. Pull the ribs down slightly so the waist reads tight. Keep the quads switched on—this pose is width with control, not a shrug.',
  },
  male_side_triceps: {
    id: 'male_side_triceps',
    name: 'Side Tricep',
    sex: 'MALE',
    divisions: [...maleDivisions],
    isMandatory: true,
    svgAssetPath: 'male_side_triceps',
    description: 'Side pose, arm nearest judges extended back to show tricep.',
    hotspots: [
      { id: 'tricep', label: 'Tricep', shape: 'rect', coords: [28, 25, 22, 40], cueTitle: 'Tricep', cueBody: 'Extend arm back fully. Show separation.' },
      { id: 'leg', label: 'Leg', shape: 'rect', coords: [18, 58, 28, 32], cueTitle: 'Quad', cueBody: 'Flex quad and calf on the side.' },
    ],
    judgeNotes: N(BB_SIDE),
    commonMistakes: ['Dropping elbow', 'Not fully extending', 'Poor leg pose'],
    tips: ['Full extension', 'Quad flexed', 'Chest out'],
    coachingScript:
      'Find your side line. Lock the near elbow into full extension and rotate the knuckles slightly outward so the tricep catches the light. Keep the chest lifted and the front quad and calf flexed—this pose is a straight line from jaw to ankle.',
  },
  male_most_muscular: {
    id: 'male_most_muscular',
    name: 'Most Muscular',
    sex: 'MALE',
    divisions: [...maleDivisions],
    isMandatory: false,
    svgAssetPath: 'male_most_muscular',
    description: 'Maximum tension through chest, arms, and traps.',
    hotspots: [
      { id: 'chest', label: 'Chest', shape: 'rect', coords: [28, 28, 44, 28], cueTitle: 'Chest and arms', cueBody: 'Squeeze everything. Control breathing.' },
      { id: 'traps', label: 'Traps', shape: 'rect', coords: [38, 12, 24, 18], cueTitle: 'Traps', cueBody: 'Engage traps without over-gripping.' },
    ],
    judgeNotes: N(BB_FRONT),
    commonMistakes: ['Over-gripping', 'Losing leg tension', 'Bad angle'],
    tips: ['Controlled squeeze', 'Breathe out', 'Hold steady'],
    coachingScript:
      'Exhale first, then drive the hands together or to the thighs depending on your variant. Squeeze chest, delts, and traps as one unit—don’t let the neck disappear. Keep legs alive with a slight knee bend so the pose reads powerful, not cramped. Two hard seconds, then relax the face.',
  },
  female_bikini_front: {
    id: 'female_bikini_front',
    name: 'Bikini Front',
    sex: 'FEMALE',
    divisions: [...femaleDivisionsBikini],
    isMandatory: true,
    svgAssetPath: 'female_bikini_front',
    description: 'Face judges, relaxed stance, one hand on hip optional. Confident, natural look.',
    hotspots: [
      { id: 'waist', label: 'Waist', shape: 'rect', coords: [35, 38, 30, 18], cueTitle: 'Waist and posture', cueBody: 'Slight twist to show waist. Keep posture tall and confident.' },
      { id: 'legs', label: 'Legs', shape: 'rect', coords: [25, 58, 50, 35], cueTitle: 'Leg line', cueBody: 'One leg slightly forward or to the side for a flattering line.' },
    ],
    judgeNotes: N(BIKINI_NOTES),
    commonMistakes: ['Over-posing', 'Too stiff', 'Losing the bikini look'],
    tips: ['Shoulders back', 'Natural curve', 'Relaxed arms'],
    coachingScript:
      'Stand relaxed but tall—think “photo shoot,” not gym flex. Soft knees, weight mostly on the back foot, optional micro-twist at the waist to show the hourglass. Hands light on the hips or at the sides; smile with the eyes. Breathe easy and let the suit line do the work.',
    coachingScriptPresentation:
      'This is a presentation pose first: shoulders open, ribcage quiet, hips neutral. Let the glutes and legs support the line without squeezing hard. Keep transitions smooth—judges score the whole package including confidence and polish.',
  },
  female_bikini_back: {
    id: 'female_bikini_back',
    name: 'Bikini Back',
    sex: 'FEMALE',
    divisions: [...femaleDivisionsBikini],
    isMandatory: true,
    svgAssetPath: 'female_bikini_back',
    description: 'Back to judges, relaxed. Slight shift to show glute shape without over-flexing.',
    hotspots: [
      { id: 'back', label: 'Back', shape: 'rect', coords: [25, 20, 50, 35], cueTitle: 'Back and shoulders', cueBody: 'Relaxed but upright. Show back shape without straining.' },
      { id: 'glutes', label: 'Glutes', shape: 'rect', coords: [32, 55, 36, 25], cueTitle: 'Glute shape', cueBody: 'Slight weight shift to show shape. Avoid over-flexing.' },
    ],
    judgeNotes: N(BIKINI_NOTES),
    commonMistakes: ['Over-flexing glutes', 'Rigid pose'],
    tips: ['Shoulders down', 'Subtle shift', 'Smooth curve'],
    coachingScript:
      'Turn your back with a long neck and relaxed arms. Shift weight slightly to the camera-side glute—enough to show shape, not a hard squeeze. Keep shoulders down and jaw soft; breathe so the lower back stays smooth.',
    coachingScriptPresentation:
      'Back pose in bikini is about shape and flow: think “lift and lengthen,” not muscle flex. Micro-shift the hips, keep the heels soft, and return the energy through the crown of the head for a tall, elegant line.',
  },
  female_bikini_side: {
    id: 'female_bikini_side',
    name: 'Bikini Side',
    sex: 'FEMALE',
    divisions: [...femaleDivisionsBikini],
    isMandatory: false,
    svgAssetPath: 'female_bikini_side',
    description: 'Side profile, relaxed, show curve of shoulder, waist, hip.',
    hotspots: [{ id: 'waist', label: 'Waist', shape: 'rect', coords: [32, 40, 36, 22], cueTitle: 'Side profile', cueBody: 'Show curves. Natural stance.' }],
    judgeNotes: N(BIKINI_NOTES),
    commonMistakes: ['Hiding glutes', 'Bad angle'],
    tips: ['Relaxed', 'Natural curve'],
    coachingScript:
      'Find your best profile: front hip slightly toward judges, back heel long. Lift through the crown of the head and relax the jaw. Keep arms soft—this pose sells the S-curve, not muscle detail.',
    coachingScriptPresentation:
      'Side bikini is runway energy: long neck, soft hands, confident gaze past the judges. Let the waist appear smaller by lengthening the space between ribs and hips—never collapse forward.',
  },
  female_figure_front: {
    id: 'female_figure_front',
    name: 'Figure Front',
    sex: 'FEMALE',
    divisions: [...femaleDivisionsFigure],
    isMandatory: true,
    svgAssetPath: 'female_figure_front',
    description: 'Face judges, relaxed but showing muscle. Slightly more muscular than bikini.',
    hotspots: [
      { id: 'shoulders', label: 'Shoulders', shape: 'rect', coords: [28, 22, 44, 24], cueTitle: 'Shoulders', cueBody: 'Show shoulder development. Symmetry.' },
      { id: 'waist', label: 'Waist', shape: 'rect', coords: [36, 44, 28, 20], cueTitle: 'Waist', cueBody: 'Controlled waist. Show proportion.' },
    ],
    judgeNotes: N(BB_FRONT),
    commonMistakes: ['Too relaxed or too flexed'],
    tips: ['Shoulders back', 'Slight flex', 'Balance'],
    coachingScript:
      'Figure front is “soft power”: shoulders open with visible development, waist controlled, quads switched on without a hard bodybuilding vacuum. Keep the face calm and the hands disciplined—show muscle with elegance.',
  },
  female_wellness_back: {
    id: 'female_wellness_back',
    name: 'Wellness Back',
    sex: 'FEMALE',
    divisions: [...femaleDivisionsWellness],
    isMandatory: true,
    svgAssetPath: 'female_wellness_back',
    description: 'Back to judges; show glute and hamstring development. Fuller, athletic look.',
    hotspots: [{ id: 'glutes', label: 'Glutes & hamstrings', shape: 'rect', coords: [28, 50, 44, 38], cueTitle: 'Lower body', cueBody: 'Show glute and hamstring development. Controlled flex.' }],
    judgeNotes: N(BIKINI_NOTES),
    commonMistakes: ['Over-flexing', 'Losing flow'],
    tips: ['Glute flex', 'Hamstring visible', 'Balance'],
    coachingScript:
      'Back to judges with a proud chest and long neck. Shift weight slightly to show glute roundness while keeping hamstrings engaged—Wellness rewards lower-body dominance with a feminine line. Avoid a deep arch; stay tall.',
    coachingScriptPresentation:
      'Think “athletic curves on display”: soft hands, confident posture, and a controlled glute squeeze that reads on stage without looking forced. Keep transitions smooth into your next pose.',
  },
  female_wellness_front: {
    id: 'female_wellness_front',
    name: 'Wellness Front',
    sex: 'FEMALE',
    divisions: [...femaleDivisionsWellness],
    isMandatory: true,
    svgAssetPath: 'female_wellness_front',
    description: 'Fuller, athletic look. Relaxed front stance, show development.',
    hotspots: [
      { id: 'legs', label: 'Legs', shape: 'rect', coords: [24, 52, 52, 40], cueTitle: 'Quad and glute', cueBody: 'Show lower body development. Athletic balance.' },
      { id: 'waist', label: 'Waist', shape: 'rect', coords: [34, 38, 32, 18], cueTitle: 'Waist', cueBody: 'Controlled. Show proportion.' },
    ],
    judgeNotes: N(BIKINI_NOTES),
    commonMistakes: ['Too soft or too hard'],
    tips: ['Athletic stance', 'Controlled flex', 'Balance'],
    coachingScript:
      'Front wellness: athletic stance with weight slightly favoring the display leg. Keep the torso tall and the waist long—show quad sweep without locking the knees. Hands relaxed; energy through the shoulders.',
    coachingScriptPresentation:
      'Lead with presence: smile, breathe, and let the lower body tell the story. Avoid over-twisting—small angles read better on video and from the judges’ line.',
  },
};

function withPoseExerciseLinks(poses: Record<string, Pose>): Record<string, Pose> {
  const out: Record<string, Pose> = {};
  for (const [id, pose] of Object.entries(poses)) {
    const links = POSE_EXERCISE_LINKS_BY_POSE_ID[id];
    if ((!links || links.length === 0) && import.meta.env?.DEV) {
      console.warn(`[poseLibraryData] Missing poseExerciseLinks for pose: ${id}`);
    }
    out[id] = { ...pose, poseExerciseLinks: links ?? [] };
  }
  return out;
}

const MERGED_POSES: Record<string, Pose> = {
  ...CORE_POSES,
  ...EXTENDED_POSE_LIBRARY_DATA,
};

export const poseLibraryData: Record<string, Pose> = withPoseExerciseLinks(MERGED_POSES);

/** Row for “poses this exercise trains” (program builder, pose chips). */
export type PoseExerciseTrainingHit = {
  poseId: string;
  poseName: string;
  poseGroup: string;
  interpretation: string;
};

/** Inverse lookup: which poses reference this library exercise in `poseExerciseLinks`. */
export function getPosesForExercise(exerciseId: string): PoseExerciseTrainingHit[] {
  if (!exerciseId) return [];
  const hits: PoseExerciseTrainingHit[] = [];
  for (const pose of Object.values(poseLibraryData)) {
    const links = pose.poseExerciseLinks ?? [];
    const match = links.find((l) => l.exerciseId === exerciseId);
    if (!match) continue;
    const poseGroup =
      pose.sex === 'MALE'
        ? "Men's mandatory and presentation poses"
        : "Women's mandatory and presentation poses";
    hits.push({
      poseId: pose.id,
      poseName: pose.name,
      poseGroup,
      interpretation: `${match.reason} That quality shows most clearly when you hit ${pose.name} for the judges.`,
    });
  }
  return hits;
}
