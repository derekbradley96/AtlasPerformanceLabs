/**
 * Mandatory poses by division. Each pose has description, what judges look for, common mistakes.
 * isMastersCompatible: Masters categories use the same mandatory structure as Open for this division.
 */

const poseEntry = (id, name, description, judgesLookFor, commonMistakes) => ({
  id,
  name,
  description,
  judgesLookFor,
  commonMistakes,
  isMastersCompatible: true,
});

const MALE_BODYBUILDING = [
  poseEntry(
    'quarter_turn_front',
    'Quarter turn front',
    'Stand square to judges, arms relaxed at sides, slight lat flare, abs tight.',
    'Overall symmetry, muscle balance, conditioning, stage presence.',
    'Locking knees, arms too far from body, no lat engagement.'
  ),
  poseEntry(
    'quarter_turn_right',
    'Quarter turn right',
    'Turn 90° clockwise; clean side line for judging profile.',
    'Side silhouette, shoulder tie-in, leg line, posture.',
    'Over-rotating shoulders, leaning away from judges, locked knees.'
  ),
  poseEntry(
    'quarter_turn_back',
    'Quarter turn back',
    'Back to judges; neutral head, relaxed arms, subtle lat engagement.',
    'Rear chain symmetry, conditioning, calm presentation.',
    'Rounded thoracic spine, shrugging, feet too narrow.'
  ),
  poseEntry(
    'quarter_turn_left',
    'Quarter turn left',
    'Turn 90° counter-clockwise from back; mirror quality of right quarter.',
    'Profile balance, waist length, shoulder line.',
    'Hips leading the turn, uneven shoulders, rushed pivot.'
  ),
  poseEntry(
    'front_double_biceps',
    'Front double biceps',
    'Face the judges, arms bent, both biceps flexed, hands at shoulder height.',
    'Symmetry of arms, shoulder width, quad sweep, overall balance.',
    'Uneven arm height, flaring lats too much, soft abs.'
  ),
  poseEntry(
    'front_lat_spread',
    'Front lat spread',
    'Face judges, arms slightly bent at sides, push lats forward and out.',
    'Lat width, taper, waist control, chest development.',
    'Rolling shoulders forward, bending elbows too much, losing abs.'
  ),
  poseEntry(
    'side_chest',
    'Side chest',
    'Turn 90° to the side, one arm bent (hand near face), other arm back, chest and leg on side flexed.',
    'Chest thickness, shoulder, tricep, quad sweep, calf.',
    'Hiding chest, bad leg angle, relaxed leg.'
  ),
  poseEntry(
    'side_triceps',
    'Side triceps',
    'Same side as side chest, arm nearest judges extended back to show tricep, other arm in front.',
    'Tricep size and separation, shoulder, chest, quad.',
    'Dropping elbow, not fully extending, poor leg pose.'
  ),
  poseEntry(
    'rear_double_biceps',
    'Rear double biceps',
    'Back to judges, both arms bent, biceps flexed, lats spread, hamstrings flexed.',
    'Back width, arm symmetry, glute-ham tie-in, conditioning.',
    'Asymmetric arms, poor leg positioning, forward lean, soft hamstrings.'
  ),
  poseEntry(
    'rear_lat_spread',
    'Rear lat spread',
    'Back to judges, arms at sides or slightly forward, lats spread wide.',
    'Lat width, lower back detail, glute-ham tie-in.',
    'Shrugging, bent arms, poor leg positioning.'
  ),
  poseEntry(
    'abdominals_and_thighs',
    'Abdominals and thighs',
    'Face judges, hands behind head or one arm up, abs tight, one leg forward with quad flexed.',
    'Ab definition, serratus, quad sweep, waist control.',
    'Not flexing the right quad, not showing serratus, poor arm placement.'
  ),
  poseEntry(
    'most_muscular',
    'Most muscular',
    'Maximum tension through chest, arms, and traps (variant as promoted).',
    'Fullness, density, conditioning, impact.',
    'Over-gripping, losing leg tension, bad angle to judges.'
  ),
];

const MALE_CLASSIC = [
  poseEntry(
    'quarter_turn_front',
    'Quarter turn front',
    'Stand square to judges, classic relaxed presentation with confidence.',
    'Overall shape, taper, proportion, conditioning.',
    'Slouching, uneven shoulders, poor stance.'
  ),
  poseEntry(
    'quarter_turn_right',
    'Quarter turn right',
    'Quarter turn right; profile for classic lines.',
    'Side silhouette, waist length, shoulder tie-in.',
    'Hips open too much, head dropped.'
  ),
  poseEntry(
    'quarter_turn_back',
    'Quarter turn back',
    'Quarter turn back; rear relaxed with optional subtle lat flare.',
    'Back width and shape, waist, glutes.',
    'Rounded back, uneven stance.'
  ),
  poseEntry(
    'quarter_turn_left',
    'Quarter turn left',
    'Quarter turn left; mirror right-quarter polish.',
    'Profile symmetry, posture, leg line.',
    'Rushed pivot, uneven shoulders.'
  ),
  poseEntry(
    'front_double_biceps',
    'Front double biceps',
    'Same as bodybuilding; emphasis on classic proportions, not extreme size.',
    'Arm symmetry, shoulder-to-waist ratio, quad sweep.',
    'Over-flexing, losing classic lines.'
  ),
  poseEntry(
    'side_chest',
    'Side chest',
    'Classic side chest: emphasis on flow and proportion.',
    'Chest shape, shoulder, arm, leg line.',
    'Hiding chest, bad leg angle, relaxed leg.'
  ),
  poseEntry(
    'back_double_biceps',
    'Back double biceps',
    'Back pose with arms flexed; classic V-taper focus.',
    'Lat width, arm symmetry, glute-ham tie-in.',
    'Asymmetry, rounded back, soft glutes.'
  ),
  poseEntry(
    'abdominals_and_thighs',
    'Abdominals and thighs',
    'Abs and quad; classic proportion over extreme conditioning.',
    'Ab definition, quad sweep, overall conditioning.',
    'Breathing in, relaxed abs, poor leg placement.'
  ),
  poseEntry(
    'favourite_classic_pose',
    'Favourite classic pose',
    'Athlete-selected classic pose showcasing strengths.',
    'Strengths of the physique, presentation, confidence.',
    'Obscuring weaknesses poorly, rushed setup.'
  ),
];

const MALE_PHYSIQUE = [
  poseEntry(
    'quarter_turn_front',
    'Quarter turn front',
    'Stand square to judges, relaxed, board shorts, slight lat flare optional.',
    'Overall symmetry, muscle balance, conditioning, stage presence.',
    'Locking knees, arms too far from body, over-flexing like bodybuilding.'
  ),
  poseEntry(
    'quarter_turn_right',
    'Quarter turn right',
    'Quarter turn right; relaxed profile, hands at sides or on hip.',
    'Taper, chest and shoulder profile, leg line.',
    'Hiding waist, bad angle, stiff arms.'
  ),
  poseEntry(
    'quarter_turn_back',
    'Quarter turn back',
    'Quarter turn back; relaxed rear, subtle V-taper.',
    'Back width, waist, glutes, overall flow.',
    'Over-spreading lats, rigid pose.'
  ),
  poseEntry(
    'quarter_turn_left',
    'Quarter turn left',
    'Quarter turn left; mirror right-quarter presentation.',
    'Profile line, confidence, polish.',
    'Uneven shoulders, rushed turn.'
  ),
  poseEntry(
    'front_pose',
    'Front pose',
    "Men's Physique front: relaxed, hands at sides or one hand in pocket, slight twist optional.",
    'X-frame, shoulder-to-waist ratio, conditioning, presence.',
    'Too stiff, no personality, poor shorts fit.'
  ),
  poseEntry(
    'back_pose',
    'Back pose',
    "Men's Physique back: relaxed rear, subtle lat engagement.",
    'Back width, waist, glutes, presentation.',
    'Over-flexing like bodybuilding, hunched upper back.'
  ),
];

const FEMALE_BIKINI = [
  poseEntry(
    'front_relaxed',
    'Front relaxed',
    'Face judges, relaxed stance, one hand on hip optional. Confident, natural look.',
    'Balance, curves, shoulder-to-hip ratio, conditioning.',
    'Over-posing, too stiff, losing the “bikini” look.'
  ),
  poseEntry(
    'front_hand_on_hip',
    'Front hand on hip',
    'One hand on hip, slight twist to show waist. Relaxed, feminine.',
    'Waist, shoulder shape, glute hint, overall balance.',
    'Squeezing waist too much, awkward arm.'
  ),
  poseEntry(
    'side_relaxed',
    'Side relaxed',
    'Turn 90°, relaxed, show profile. Curve of shoulder, chest, waist, hip.',
    'Side profile, curves, proportion.',
    'Hiding glutes, bad angle.'
  ),
  poseEntry(
    'back_relaxed',
    'Back relaxed',
    'Back to judges, relaxed. Slight shift to show glute shape without over-flexing.',
    'Back shape, glute shape, waist, overall flow.',
    'Over-flexing glutes, rigid.'
  ),
  poseEntry(
    'walking_turn',
    'Walking turn',
    'Model walk and turn; transition and presence.',
    'Presentation, confidence, flow, overall package.',
    'Rushed walk, bad posture on turn.'
  ),
];

const FEMALE_WELLNESS = [
  poseEntry(
    'front_relaxed',
    'Front relaxed',
    'Fuller, athletic look. Relaxed front stance, show development.',
    'Muscle development, curves, shoulder-to-hip, conditioning.',
    'Too soft or too hard; find wellness balance.'
  ),
  poseEntry(
    'front_hand_on_hip',
    'Front hand on hip',
    'One hand on hip, show quad and glute development.',
    'Quad sweep, glute shape, waist, balance.',
    'Over-twisting, losing lower body display.'
  ),
  poseEntry(
    'side_relaxed',
    'Side relaxed',
    'Side profile; show leg and glute development, shoulder line.',
    'Lower body development, proportion, curves.',
    'Hiding legs, bad angle.'
  ),
  poseEntry(
    'back_relaxed',
    'Back relaxed',
    'Back to judges; show glute and hamstring development.',
    'Glute shape and size, hamstrings, back, waist.',
    'Over-flexing, losing flow.'
  ),
  poseEntry(
    'walking_turn',
    'Walking turn',
    'Confident walk and turn; showcase full package.',
    'Presentation, muscle flow, confidence.',
    'Same as bikini walking turn.'
  ),
];

const FEMALE_FIGURE = [
  poseEntry(
    'front_relaxed',
    'Front relaxed',
    'Face judges, relaxed but showing muscle. Slightly more muscular than bikini.',
    'Symmetry, shoulder development, waist, quad hint.',
    'Too relaxed or too flexed.'
  ),
  poseEntry(
    'front_double_biceps',
    'Front double biceps',
    'Arms bent, biceps flexed; figure-appropriate degree of flex.',
    'Arm symmetry, shoulders, chest, waist.',
    'Over-flexing like bodybuilding.'
  ),
  poseEntry(
    'side_chest',
    'Side chest',
    'Turn 90°, one arm bent, show chest and shoulder profile.',
    'Chest, shoulder, arm, leg line.',
    'Bad angle, relaxed leg.'
  ),
  poseEntry(
    'side_triceps',
    'Side triceps',
    'Side pose showing tricep and shoulder.',
    'Arm definition, shoulder, quad.',
    'Same as male side triceps mistakes.'
  ),
  poseEntry(
    'back_relaxed',
    'Back relaxed',
    'Back to judges, lats slightly spread, show back development.',
    'Back width and detail, waist, glutes.',
    'Rounded back, over-spreading.'
  ),
  poseEntry(
    'rear_double_biceps',
    'Rear double biceps',
    'Back pose, arms flexed; show back and arm symmetry.',
    'Back symmetry, arm symmetry, glute-ham.',
    'Asymmetry, forward lean.'
  ),
  poseEntry(
    'walking_turn',
    'Walking turn',
    'Model walk and turn with figure presentation.',
    'Presentation, muscle flow, confidence.',
    'Same as bikini/wellness.'
  ),
];

/** Women's Bodybuilding — 4 quarter turns + 7 mandatories (no extra MM in this set). */
const WOMENS_BODYBUILDING_SET = [
  poseEntry('quarter_turn_front', 'Quarter turn front', 'Square front presentation.', 'Symmetry, balance, conditioning.', 'Locked knees, poor posture.'),
  poseEntry('quarter_turn_right', 'Quarter turn right', 'Quarter turn right.', 'Profile line, muscle detail.', 'Rushed turn.'),
  poseEntry('quarter_turn_back', 'Quarter turn back', 'Back to judges, quarter line.', 'Rear symmetry, conditioning.', 'Rounded back.'),
  poseEntry('quarter_turn_left', 'Quarter turn left', 'Quarter turn left.', 'Profile balance.', 'Uneven shoulders.'),
  poseEntry(
    'front_double_biceps',
    'Front double biceps',
    'Face judges, arms bent, both biceps flexed.',
    'Arm symmetry, shoulder width, density, quads.',
    'Uneven arms, soft midsection.'
  ),
  poseEntry(
    'front_lat_spread',
    'Front lat spread',
    'Face judges, lats spread forward and out.',
    'Lat width, taper, waist control.',
    'Over-elbow bend, lost abs.'
  ),
  poseEntry(
    'side_chest',
    'Side chest',
    'Side chest mandatory.',
    'Chest thickness, shoulder, leg line.',
    'Hiding chest, soft leg.'
  ),
  poseEntry(
    'side_triceps',
    'Side triceps',
    'Side triceps mandatory.',
    'Tricep separation, shoulder, quad.',
    'Bent elbow, dropped shoulder.'
  ),
  poseEntry(
    'rear_double_biceps',
    'Rear double biceps',
    'Back double biceps mandatory.',
    'Back width, arm symmetry, hamstrings.',
    'Asymmetric arms, forward lean.'
  ),
  poseEntry(
    'rear_lat_spread',
    'Rear lat spread',
    'Rear lat spread mandatory.',
    'Lat width, lower back detail, tie-in.',
    'Shrugging, bent arms.'
  ),
  poseEntry(
    'abdominals_and_thighs',
    'Abdominals and thighs',
    'Abs and thigh mandatory.',
    'Ab definition, serratus, quad sweep.',
    'Soft quad, poor arm placement.'
  ),
];

/** Women's Physique — same 11 mandatories as women’s bodybuilding (per spec). */
const WOMENS_PHYSIQUE_SET = WOMENS_BODYBUILDING_SET;

const FEMALE_FITNESS = [
  poseEntry('quarter_turn_front', 'Quarter turn front', 'Fitness quarter front.', 'Athleticism, polish, readiness.', 'Loose core.'),
  poseEntry('quarter_turn_right', 'Quarter turn right', 'Fitness quarter right.', 'Profile, lines, confidence.', 'Bad angle.'),
  poseEntry('quarter_turn_back', 'Quarter turn back', 'Fitness quarter back.', 'Rear athletic line.', 'Rounded shoulders.'),
  poseEntry('quarter_turn_left', 'Quarter turn left', 'Fitness quarter left.', 'Mirror profile quality.', 'Rushed pivot.'),
  poseEntry(
    'fitness_routine_mandatory',
    'Fitness routine',
    'Routine block: strength, flexibility, gymnastics elements as required.',
    'Difficulty, execution, artistry, presentation.',
    'Out of bounds, weak landings, rushed transitions.'
  ),
];

const WHEELCHAIR_OPEN = [
  poseEntry(
    'front_symmetry',
    'Front symmetry',
    'Seated front symmetry — upper body balance and proportion.',
    'Symmetry, shoulder line, core control, presentation.',
    'Uneven shoulders, collapsed torso.'
  ),
  poseEntry(
    'rear_symmetry',
    'Rear symmetry',
    'Seated rear symmetry — back width and balance.',
    'Back development, symmetry, conditioning.',
    'Twisted torso, low head.'
  ),
  poseEntry(
    'side_symmetry',
    'Side symmetry',
    'Seated side symmetry — profile line.',
    'Profile balance, shoulder tie-in, posture.',
    'Leaning away, uneven elbows.'
  ),
  poseEntry(
    'most_muscular_seated',
    'Most muscular (seated)',
    'Seated most muscular — controlled peak contraction.',
    'Upper-body density, control, impact.',
    'Over-gripping, losing neck alignment.'
  ),
];

/** Division key to pose set (array of pose entries). */
export const divisionPoseSets = {
  Bodybuilding: MALE_BODYBUILDING,
  mens_bodybuilding: MALE_BODYBUILDING,
  mens_open_bodybuilding: MALE_BODYBUILDING,
  BODYBUILDING: MALE_BODYBUILDING,
  'Classic Physique': MALE_CLASSIC,
  classic_physique: MALE_CLASSIC,
  CLASSIC: MALE_CLASSIC,
  'Men\'s Physique': MALE_PHYSIQUE,
  'Mens Physique': MALE_PHYSIQUE,
  Physique: MALE_PHYSIQUE,
  mens_physique: MALE_PHYSIQUE,
  PHYSIQUE: MALE_PHYSIQUE,
  'Wheelchair Open': WHEELCHAIR_OPEN,
  wheelchair_open: WHEELCHAIR_OPEN,
  WHEELCHAIR_OPEN: WHEELCHAIR_OPEN,
  womens_bodybuilding: WOMENS_BODYBUILDING_SET,
  'Women\'s Bodybuilding': WOMENS_BODYBUILDING_SET,
  WOMENS_BODYBUILDING: WOMENS_BODYBUILDING_SET,
  womens_physique: WOMENS_PHYSIQUE_SET,
  'Women\'s Physique': WOMENS_PHYSIQUE_SET,
  WOMENS_PHYSIQUE: WOMENS_PHYSIQUE_SET,
  fitness: FEMALE_FITNESS,
  Fitness: FEMALE_FITNESS,
  FITNESS: FEMALE_FITNESS,
  figure: FEMALE_FIGURE,
  bikini: FEMALE_BIKINI,
  Bikini: FEMALE_BIKINI,
  BIKINI: FEMALE_BIKINI,
  Wellness: FEMALE_WELLNESS,
  wellness: FEMALE_WELLNESS,
  WELLNESS: FEMALE_WELLNESS,
  Figure: FEMALE_FIGURE,
  FIGURE: FEMALE_FIGURE,
};

/** DB / enum / slug → key that exists on divisionPoseSets */
const ENUM_OR_ALIAS_TO_POSE_SET_KEY = {
  BIKINI: 'Bikini',
  FIGURE: 'Figure',
  WELLNESS: 'Wellness',
  FITNESS: 'Fitness',
  WOMENS_BODYBUILDING: 'Women\'s Bodybuilding',
  WOMENS_PHYSIQUE: 'Women\'s Physique',
  BODYBUILDING: 'Bodybuilding',
  MENS_BODYBUILDING: 'Bodybuilding',
  MENS_OPEN_BODYBUILDING: 'Bodybuilding',
  MENS_BB: 'Bodybuilding',
  CLASSIC: 'Classic Physique',
  CLASSIC_PHYSIQUE: 'Classic Physique',
  PHYSIQUE: 'Men\'s Physique',
  MENS_PHYSIQUE: 'Men\'s Physique',
  MENS_OPEN_PHYSIQUE: 'Men\'s Physique',
  WHEELCHAIR_OPEN: 'Wheelchair Open',
  MENS_WHEELCHAIR: 'Wheelchair Open',
};

const LIB = {
  BIKINI: ['BIKINI'],
  FIGURE: ['FIGURE'],
  WELLNESS: ['WELLNESS'],
  FITNESS: ['FITNESS'],
  WOMENS_BODYBUILDING: ['WOMENS_BODYBUILDING'],
  WOMENS_PHYSIQUE: ['WOMENS_PHYSIQUE'],
  BODYBUILDING: ['BODYBUILDING'],
  CLASSIC: ['CLASSIC'],
  PHYSIQUE: ['PHYSIQUE'],
  WHEELCHAIR_OPEN: ['WHEELCHAIR_OPEN'],
};

/** divisionPoseSets key → tags used on Pose.divisions in poseLibraryData */
const POSE_SET_KEY_TO_LIBRARY_DIVISION_TAGS = {
  Bikini: LIB.BIKINI,
  BIKINI: LIB.BIKINI,
  Figure: LIB.FIGURE,
  FIGURE: LIB.FIGURE,
  Wellness: LIB.WELLNESS,
  WELLNESS: LIB.WELLNESS,
  Fitness: LIB.FITNESS,
  FITNESS: LIB.FITNESS,
  'Women\'s Bodybuilding': LIB.WOMENS_BODYBUILDING,
  WOMENS_BODYBUILDING: LIB.WOMENS_BODYBUILDING,
  'Women\'s Physique': LIB.WOMENS_PHYSIQUE,
  WOMENS_PHYSIQUE: LIB.WOMENS_PHYSIQUE,
  Bodybuilding: LIB.BODYBUILDING,
  BODYBUILDING: LIB.BODYBUILDING,
  'Classic Physique': LIB.CLASSIC,
  CLASSIC: LIB.CLASSIC,
  'Men\'s Physique': LIB.PHYSIQUE,
  Physique: LIB.PHYSIQUE,
  PHYSIQUE: LIB.PHYSIQUE,
  mens_physique: LIB.PHYSIQUE,
  'Wheelchair Open': LIB.WHEELCHAIR_OPEN,
  WHEELCHAIR_OPEN: LIB.WHEELCHAIR_OPEN,
  wheelchair_open: LIB.WHEELCHAIR_OPEN,
};

/**
 * Normalize profile / client division strings to a divisionPoseSets key.
 * @param {string} [division]
 */
export function normalizeDivisionForPoses(division) {
  if (!division || typeof division !== 'string') return '';
  const key = division.trim();
  if (divisionPoseSets[key]) return key;
  const upper = key.toUpperCase().replace(/[\s'-]+/g, '_').replace(/_+/g, '_');
  if (ENUM_OR_ALIAS_TO_POSE_SET_KEY[upper]) return ENUM_OR_ALIAS_TO_POSE_SET_KEY[upper];
  const spaced = key.replace(/_/g, ' ');
  if (divisionPoseSets[spaced]) return spaced;
  const lower = key.toLowerCase();
  if (divisionPoseSets[lower]) return lower;
  return key;
}

/**
 * All division tags to match against Pose.divisions (enum strings in pose library).
 * @param {string} [division]
 * @returns {string[]}
 */
export function toPoseLibraryDivisionTags(division) {
  if (!division || typeof division !== 'string') return [];
  const raw = division.trim();
  const tags = new Set();
  tags.add(raw);
  const upper = raw.toUpperCase().replace(/[\s'-]+/g, '_').replace(/_+/g, '_');
  tags.add(upper);

  const canon = normalizeDivisionForPoses(raw);
  tags.add(canon);
  const fromCanon = POSE_SET_KEY_TO_LIBRARY_DIVISION_TAGS[canon];
  if (fromCanon) fromCanon.forEach((t) => tags.add(t));
  const fromRaw = POSE_SET_KEY_TO_LIBRARY_DIVISION_TAGS[raw];
  if (fromRaw) fromRaw.forEach((t) => tags.add(t));
  const fromUpper = POSE_SET_KEY_TO_LIBRARY_DIVISION_TAGS[upper];
  if (fromUpper) fromUpper.forEach((t) => tags.add(t));

  return [...tags].filter(Boolean);
}

/**
 * @param {string} [division] - e.g. 'Bikini', 'Men\'s Physique', 'WOMENS_BODYBUILDING', 'BIKINI'
 * @returns {Array<{ id: string; name: string; description: string; judgesLookFor: string; commonMistakes: string; isMastersCompatible?: boolean }>}
 */
export function getPosesForDivision(division) {
  if (!division || typeof division !== 'string') return [];
  const trimmed = division.trim();
  const canon = normalizeDivisionForPoses(trimmed);
  return (
    divisionPoseSets[canon] ??
    divisionPoseSets[trimmed] ??
    divisionPoseSets[trimmed.replace(/_/g, ' ')] ??
    []
  );
}

export const PREP_PHASES = [
  { value: 'off_season', label: 'Off season' },
  { value: 'prep', label: 'Prep' },
  { value: 'peak_week', label: 'Peak week' },
  { value: 'show_day', label: 'Show day' },
];

export const FEDERATIONS = [
  'NPC',
  'IFBB',
  'NANBF',
  'OCB',
  'PCA',
  'UKBFF',
  'NABBA',
  'WBFF',
  'Pure Elite',
  'Ben Weider',
  'WNBF',
  'INBF',
  'IPE',
  'Natural Physique Association',
  'IFBB Pro League',
  '2BROS',
  'OTHER',
];

export const DIVISIONS_MALE = ['Bodybuilding', 'Classic Physique', 'Men\'s Physique', 'Wheelchair Open'];
export const DIVISIONS_FEMALE = [
  'Bikini',
  'Wellness',
  'Figure',
  'Women\'s Bodybuilding',
  'Women\'s Physique',
  'Fitness',
];
