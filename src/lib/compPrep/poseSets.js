/**
 * Mandatory poses by division. Each pose has description, what judges look for, common mistakes.
 * Male: Bodybuilding, Classic Physique, Men's Physique.
 * Female: Bikini, Wellness, Figure.
 */

const poseEntry = (id, name, description, judgesLookFor, commonMistakes) => ({
  id,
  name,
  description,
  judgesLookFor,
  commonMistakes,
});

const MALE_BODYBUILDING = [
  poseEntry(
    'front_double_bicep',
    'Front double bicep',
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
    'side_tricep',
    'Side tricep',
    'Same side as side chest, arm nearest judges extended back to show tricep, other arm in front.',
    'Tricep size and separation, shoulder, chest, quad.',
    'Dropping elbow, not fully extending, poor leg pose.'
  ),
  poseEntry(
    'back_double_bicep',
    'Back double bicep',
    'Back to judges, both arms bent, biceps flexed, lats spread.',
    'Back width and detail, arm symmetry, glutes, hamstrings.',
    'Asymmetry, rounded back, soft glutes.'
  ),
  poseEntry(
    'back_lat_spread',
    'Back lat spread',
    'Back to judges, arms at sides or slightly forward, lats spread wide.',
    'Lat width, lower back detail, glute-ham tie-in.',
    'Shrugging, bent arms, poor leg positioning.'
  ),
  poseEntry(
    'abdominal_thigh',
    'Abdominal and thigh',
    'Face judges, hands behind head or one arm up, abs tight, one leg forward with quad flexed.',
    'Ab definition, quad sweep, overall conditioning.',
    'Breathing in, relaxed abs, poor leg placement.'
  ),
  poseEntry(
    'most_muscular',
    'Most muscular',
    'Multiple variants (crab, hands on hips, etc.). Maximum tension through chest, arms, and traps.',
    'Fullness, density, conditioning, intimidation factor.',
    'Over-gripping, losing leg tension, bad angle to judges.'
  ),
];

const MALE_CLASSIC = [
  poseEntry(
    'front_relaxed',
    'Front relaxed',
    'Stand facing judges, relaxed but confident, hands at sides or one slightly out.',
    'Overall shape, taper, proportion, conditioning.',
    'Slouching, uneven shoulders, poor stance.'
  ),
  poseEntry(
    'front_double_bicep',
    'Front double bicep',
    'Same as bodybuilding; emphasis on classic proportions, not extreme size.',
    'Arm symmetry, shoulder-to-waist ratio, quad sweep.',
    'Over-flexing, losing classic lines.'
  ),
  poseEntry(
    'side_chest',
    'Side chest',
    'Classic side chest: emphasis on flow and proportion.',
    'Chest shape, shoulder, arm, leg line.',
    'Same as bodybuilding side chest.'
  ),
  poseEntry(
    'side_tricep',
    'Side tricep',
    'Tricep and shoulder emphasis with classic proportions.',
    'Arm and shoulder detail, quad, overall balance.',
    'Same as bodybuilding side tricep.'
  ),
  poseEntry(
    'back_relaxed',
    'Back relaxed',
    'Back to judges, relaxed posture, slight lat spread optional.',
    'Back width and shape, waist, glutes.',
    'Rounded back, uneven stance.'
  ),
  poseEntry(
    'back_double_bicep',
    'Back double bicep',
    'Back pose with arms flexed; classic V-taper focus.',
    'Lat width, arm symmetry, glute-ham tie-in.',
    'Same as bodybuilding.'
  ),
  poseEntry(
    'abdominal_thigh',
    'Abdominal and thigh',
    'Abs and quad; classic proportion over extreme conditioning.',
    'Ab definition, quad sweep, overall conditioning.',
    'Same as bodybuilding.'
  ),
];

const MALE_PHYSIQUE = [
  poseEntry(
    'front_relaxed',
    'Front relaxed',
    'Stand facing judges, relaxed, athletic look. Hands at sides or one hand on hip.',
    'Overall shape, shoulder-to-waist ratio, lean muscle, aesthetics.',
    'Too stiff, bodybuilding-style flexing.'
  ),
  poseEntry(
    'side_relaxed',
    'Side relaxed',
    'Turn 90°, relaxed stance, show profile. One hand may be in pocket or on hip.',
    'Taper, chest and shoulder profile, leg line.',
    'Hiding waist, bad angle.'
  ),
  poseEntry(
    'back_relaxed',
    'Back relaxed',
    'Back to judges, relaxed, slight lat spread to show V-taper.',
    'Back width, waist, glutes, overall flow.',
    'Over-spreading lats, rigid pose.'
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
    'front_double_bicep',
    'Front double bicep (quarter turn)',
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
    'side_tricep',
    'Side tricep',
    'Side pose showing tricep and shoulder.',
    'Arm definition, shoulder, quad.',
    'Same as male side tricep mistakes.'
  ),
  poseEntry(
    'back_relaxed',
    'Back relaxed',
    'Back to judges, lats slightly spread, show back development.',
    'Back width and detail, waist, glutes.',
    'Rounded back, over-spreading.'
  ),
  poseEntry(
    'back_double_bicep',
    'Back double bicep',
    'Back pose, arms flexed; show back and arm symmetry.',
    'Back symmetry, arm symmetry, glute-ham.',
    'Same as others.'
  ),
  poseEntry(
    'walking_turn',
    'Walking turn',
    'Model walk and turn with figure presentation.',
    'Presentation, muscle flow, confidence.',
    'Same as bikini/wellness.'
  ),
];

/** Division key to pose set (array of pose entries). */
export const divisionPoseSets = {
  'Bodybuilding': MALE_BODYBUILDING,
  'Classic Physique': MALE_CLASSIC,
  'Men\'s Physique': MALE_PHYSIQUE,
  'Mens Physique': MALE_PHYSIQUE,
  'Physique': MALE_PHYSIQUE,
  Bikini: FEMALE_BIKINI,
  Wellness: FEMALE_WELLNESS,
  Figure: FEMALE_FIGURE,
};

/**
 * @param {string} [division] - e.g. 'Bikini', 'Men\'s Physique'
 * @returns {Array<{ id: string; name: string; description: string; judgesLookFor: string; commonMistakes: string }>}
 */
export function getPosesForDivision(division) {
  if (!division || typeof division !== 'string') return [];
  const key = division.trim();
  return divisionPoseSets[key] ?? [];
}

export const PREP_PHASES = [
  { value: 'off_season', label: 'Off season' },
  { value: 'prep', label: 'Prep' },
  { value: 'peak_week', label: 'Peak week' },
  { value: 'show_day', label: 'Show day' },
];

export const FEDERATIONS = ['NPC', 'IFBB', 'NANBF', 'OCB'];

export const DIVISIONS_MALE = ['Bodybuilding', 'Classic Physique', 'Men\'s Physique'];
export const DIVISIONS_FEMALE = ['Bikini', 'Wellness', 'Figure'];
