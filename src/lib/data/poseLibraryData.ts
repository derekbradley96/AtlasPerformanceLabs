/**
 * Pose library: 12 poses (6 male, 6 female) with hotspots and federation judgeNotes.
 * Structure is data-driven; copy can be placeholder.
 */
import type { Pose } from '@/lib/models/poseLibrary';

const maleDivisions = ['BODYBUILDING', 'CLASSIC', 'PHYSIQUE'] as const;
const femaleDivisions = ['BIKINI', 'FIGURE', 'WELLNESS'] as const;

export const poseLibraryData: Record<string, Pose> = {
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
    judgeNotes: [
      { federation: 'PCA', bullets: ['Symmetry of arms', 'Shoulder width', 'Overall balance'] },
      { federation: '2BROS', bullets: ['Arm development', 'Core control', 'Presentation'] },
    ],
    commonMistakes: ['Uneven arm height', 'Flaring lats too much', 'Soft abs'],
    tips: ['Equal arm height', 'Slight vacuum', 'Full squeeze'],
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
    judgeNotes: [
      { federation: 'PCA', bullets: ['Chest thickness', 'Shoulder', 'Leg line'] },
      { federation: '2BROS', bullets: ['Side profile', 'Proportion', 'Conditioning'] },
    ],
    commonMistakes: ['Hiding chest', 'Bad leg angle', 'Relaxed leg'],
    tips: ['Chest up', 'Quad flexed', 'Calf flexed'],
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
    judgeNotes: [
      { federation: 'PCA', bullets: ['Lat width', 'Lower back detail', 'Glute-ham tie-in'] },
      { federation: '2BROS', bullets: ['V-taper', 'Back density', 'Presentation'] },
    ],
    commonMistakes: ['Shrugging', 'Bent arms', 'Poor leg positioning'],
    tips: ['Elbows slightly forward', 'Squeeze shoulder blades', 'Width'],
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
    judgeNotes: [
      { federation: 'PCA', bullets: ['Lat width', 'Taper', 'Waist control'] },
      { federation: '2BROS', bullets: ['Chest development', 'Symmetry', 'Conditioning'] },
    ],
    commonMistakes: ['Rolling shoulders forward', 'Bending elbows too much'],
    tips: ['Push lats out', 'Chest up', 'Abs tight'],
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
    judgeNotes: [
      { federation: 'PCA', bullets: ['Tricep size and separation', 'Shoulder', 'Leg line'] },
      { federation: '2BROS', bullets: ['Arm detail', 'Proportion', 'Conditioning'] },
    ],
    commonMistakes: ['Dropping elbow', 'Not fully extending', 'Poor leg pose'],
    tips: ['Full extension', 'Quad flexed', 'Chest out'],
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
    judgeNotes: [
      { federation: 'PCA', bullets: ['Fullness', 'Density', 'Conditioning'] },
      { federation: '2BROS', bullets: ['Overall impact', 'Presentation', 'Control'] },
    ],
    commonMistakes: ['Over-gripping', 'Losing leg tension', 'Bad angle'],
    tips: ['Controlled squeeze', 'Breathe out', 'Hold steady'],
  },
  female_bikini_front: {
    id: 'female_bikini_front',
    name: 'Bikini Front',
    sex: 'FEMALE',
    divisions: ['BIKINI'],
    isMandatory: true,
    svgAssetPath: 'female_bikini_front',
    description: 'Face judges, relaxed stance, one hand on hip optional. Confident, natural look.',
    hotspots: [
      { id: 'waist', label: 'Waist', shape: 'rect', coords: [35, 38, 30, 18], cueTitle: 'Waist and posture', cueBody: 'Slight twist to show waist. Keep posture tall and confident.' },
      { id: 'legs', label: 'Legs', shape: 'rect', coords: [25, 58, 50, 35], cueTitle: 'Leg line', cueBody: 'One leg slightly forward or to the side for a flattering line.' },
    ],
    judgeNotes: [
      { federation: 'PCA', bullets: ['Balance', 'Curves', 'Shoulder-to-hip ratio'] },
      { federation: '2BROS', bullets: ['Presentation', 'Conditioning', 'Flow'] },
    ],
    commonMistakes: ['Over-posing', 'Too stiff', 'Losing the bikini look'],
    tips: ['Shoulders back', 'Natural curve', 'Relaxed arms'],
  },
  female_bikini_back: {
    id: 'female_bikini_back',
    name: 'Bikini Back',
    sex: 'FEMALE',
    divisions: ['BIKINI'],
    isMandatory: true,
    svgAssetPath: 'female_bikini_back',
    description: 'Back to judges, relaxed. Slight shift to show glute shape without over-flexing.',
    hotspots: [
      { id: 'back', label: 'Back', shape: 'rect', coords: [25, 20, 50, 35], cueTitle: 'Back and shoulders', cueBody: 'Relaxed but upright. Show back shape without straining.' },
      { id: 'glutes', label: 'Glutes', shape: 'rect', coords: [32, 55, 36, 25], cueTitle: 'Glute shape', cueBody: 'Slight weight shift to show shape. Avoid over-flexing.' },
    ],
    judgeNotes: [
      { federation: 'PCA', bullets: ['Back shape', 'Glute shape', 'Waist', 'Flow'] },
      { federation: '2BROS', bullets: ['Overall package', 'Presentation'] },
    ],
    commonMistakes: ['Over-flexing glutes', 'Rigid pose'],
    tips: ['Shoulders down', 'Subtle shift', 'Smooth curve'],
  },
  female_bikini_side: {
    id: 'female_bikini_side',
    name: 'Bikini Side',
    sex: 'FEMALE',
    divisions: ['BIKINI'],
    isMandatory: false,
    svgAssetPath: 'female_bikini_side',
    description: 'Side profile, relaxed, show curve of shoulder, waist, hip.',
    hotspots: [
      { id: 'waist', label: 'Waist', shape: 'rect', coords: [32, 40, 36, 22], cueTitle: 'Side profile', cueBody: 'Show curves. Natural stance.' },
    ],
    judgeNotes: [
      { federation: 'PCA', bullets: ['Side profile', 'Proportion', 'Curves'] },
      { federation: '2BROS', bullets: ['Flow', 'Presentation'] },
    ],
    commonMistakes: ['Hiding glutes', 'Bad angle'],
    tips: ['Relaxed', 'Natural curve'],
  },
  female_figure_front: {
    id: 'female_figure_front',
    name: 'Figure Front',
    sex: 'FEMALE',
    divisions: ['FIGURE'],
    isMandatory: true,
    svgAssetPath: 'female_figure_front',
    description: 'Face judges, relaxed but showing muscle. Slightly more muscular than bikini.',
    hotspots: [
      { id: 'shoulders', label: 'Shoulders', shape: 'rect', coords: [28, 22, 44, 24], cueTitle: 'Shoulders', cueBody: 'Show shoulder development. Symmetry.' },
      { id: 'waist', label: 'Waist', shape: 'rect', coords: [36, 44, 28, 20], cueTitle: 'Waist', cueBody: 'Controlled waist. Show proportion.' },
    ],
    judgeNotes: [
      { federation: 'PCA', bullets: ['Symmetry', 'Shoulder development', 'Waist'] },
      { federation: '2BROS', bullets: ['Muscle balance', 'Conditioning', 'Presentation'] },
    ],
    commonMistakes: ['Too relaxed or too flexed'],
    tips: ['Shoulders back', 'Slight flex', 'Balance'],
  },
  female_wellness_back: {
    id: 'female_wellness_back',
    name: 'Wellness Back',
    sex: 'FEMALE',
    divisions: ['WELLNESS'],
    isMandatory: true,
    svgAssetPath: 'female_wellness_back',
    description: 'Back to judges; show glute and hamstring development. Fuller, athletic look.',
    hotspots: [
      { id: 'glutes', label: 'Glutes & hamstrings', shape: 'rect', coords: [28, 50, 44, 38], cueTitle: 'Lower body', cueBody: 'Show glute and hamstring development. Controlled flex.' },
    ],
    judgeNotes: [
      { federation: 'PCA', bullets: ['Glute shape and size', 'Hamstrings', 'Back', 'Waist'] },
      { federation: '2BROS', bullets: ['Lower body development', 'Proportion', 'Conditioning'] },
    ],
    commonMistakes: ['Over-flexing', 'Losing flow'],
    tips: ['Glute flex', 'Hamstring visible', 'Balance'],
  },
  female_wellness_front: {
    id: 'female_wellness_front',
    name: 'Wellness Front',
    sex: 'FEMALE',
    divisions: ['WELLNESS'],
    isMandatory: true,
    svgAssetPath: 'female_wellness_front',
    description: 'Fuller, athletic look. Relaxed front stance, show development.',
    hotspots: [
      { id: 'legs', label: 'Legs', shape: 'rect', coords: [24, 52, 52, 40], cueTitle: 'Quad and glute', cueBody: 'Show lower body development. Athletic balance.' },
      { id: 'waist', label: 'Waist', shape: 'rect', coords: [34, 38, 32, 18], cueTitle: 'Waist', cueBody: 'Controlled. Show proportion.' },
    ],
    judgeNotes: [
      { federation: 'PCA', bullets: ['Muscle development', 'Curves', 'Shoulder-to-hip'] },
      { federation: '2BROS', bullets: ['Balance', 'Conditioning', 'Flow'] },
    ],
    commonMistakes: ['Too soft or too hard'],
    tips: ['Athletic stance', 'Controlled flex', 'Balance'],
  },
};
