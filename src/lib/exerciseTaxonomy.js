/**
 * Atlas exercise tag dictionary — single source of truth for library rows, imports, UI filters, and DB CHECK alignment.
 * Stored values are snake_case; use label helpers for display.
 */

export const ATLAS_MOVEMENT_PATTERNS = [
  'push',
  'pull',
  'squat',
  'hinge',
  'lunge',
  'carry',
  'isolation',
  'plyometric',
  'rotation',
  'other',
];

export const ATLAS_MUSCLES = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
  'traps',
  'neck',
  'full_body',
];

/** Primary equipment slug (equipment_primary column). */
export const ATLAS_EQUIPMENT_PRIMARY = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'cable',
  'machine',
  'bodyweight',
  'band',
  'trx',
  'medicine_ball',
  'ez_bar',
  'smith_machine',
  'other',
];

export const ATLAS_EQUIPMENT_CATEGORY = [
  'bodyweight',
  'free_weights',
  'cable',
  'machine',
  'bands',
  'suspension',
  'mixed',
  'other',
];

export const ATLAS_BEST_FOR_GOALS = [
  'fat_loss',
  'muscle_gain',
  'hypertrophy',
  'strength',
  'power',
  'endurance',
  'mobility',
  'general_fitness',
  'sport_specific',
  'competition_prep',
];

export const ATLAS_PROGRAM_ROLES = [
  'main_lift',
  'secondary',
  'accessory',
  'warmup',
  'finisher',
  'cardio',
  'mobility',
  'prep',
  'recovery',
];

export const ATLAS_SESSION_WINDOWS = ['main', 'secondary', 'warmup', 'finisher', 'cooldown'];

export const ATLAS_GYM_CONTEXT_TAGS = ['home_gym', 'commercial_gym', 'outdoor', 'minimal_equipment'];

export const ATLAS_BODY_CONTEXT_TAGS = ['beginner_friendly', 'intermediate', 'advanced', 'injury_friendly'];

export const ATLAS_PREP_CONTEXT_TAGS = ['off_season', 'pre_contest', 'peak_week'];

/** Closed vocabulary for exercise_library.tags (no free-text). */
export const ATLAS_EXERCISE_TAGS = [
  'compound',
  'isolation',
  'unilateral',
  'bilateral',
  'machine_preferred',
  'time_efficient',
  'skill_intensive',
];

export const ATLAS_DIFFICULTY = ['beginner', 'intermediate', 'advanced'];

export const ATLAS_EXERCISE_TYPE = ['compound', 'accessory', 'warmup', 'finisher', 'cardio', 'mobility'];

export const ATLAS_SKILL_REQUIREMENT = ['low', 'moderate', 'high'];

export const ATLAS_FATIGUE_COST = ['low', 'moderate', 'high'];

export const ATLAS_STABILITY_DEMAND = ['low', 'moderate', 'high'];

export const ATLAS_LOADING_PROFILE = ['loadable', 'limited_load', 'bodyweight_only'];

export const ATLAS_UNILATERAL_TYPE = ['bilateral', 'single_side', 'alternating'];

export const ATLAS_BODY_POSITION = ['standing', 'seated', 'lying', 'kneeling', 'hanging', 'other'];

export const ATLAS_LIBRARY_STATUS = ['active', 'archived', 'draft'];

export const ATLAS_SUBSTITUTION_RELATION = ['close', 'broad', 'regression', 'progression'];

const MUSCLE_SET = new Set(ATLAS_MUSCLES);
const MOVEMENT_SET = new Set(ATLAS_MOVEMENT_PATTERNS);
const EQUIP_PRIMARY_SET = new Set(ATLAS_EQUIPMENT_PRIMARY);
const EQUIP_CAT_SET = new Set(ATLAS_EQUIPMENT_CATEGORY);
const GOALS_SET = new Set(ATLAS_BEST_FOR_GOALS);
const ROLES_SET = new Set(ATLAS_PROGRAM_ROLES);
const SESSION_SET = new Set(ATLAS_SESSION_WINDOWS);
const GYM_SET = new Set(ATLAS_GYM_CONTEXT_TAGS);
const BODY_CTX_SET = new Set(ATLAS_BODY_CONTEXT_TAGS);
const PREP_CTX_SET = new Set(ATLAS_PREP_CONTEXT_TAGS);
const TAGS_SET = new Set(ATLAS_EXERCISE_TAGS);

/** Map external / legacy strings → canonical muscle slug. */
export const MUSCLE_ALIAS_TO_CANONICAL = new Map([
  ['chest', 'chest'],
  ['pecs', 'chest'],
  ['pec', 'chest'],
  ['back', 'back'],
  ['lats', 'back'],
  ['lat', 'back'],
  ['shoulders', 'shoulders'],
  ['shoulder', 'shoulders'],
  ['delts', 'shoulders'],
  ['deltoids', 'shoulders'],
  ['quads', 'quads'],
  ['quadriceps', 'quads'],
  ['quad', 'quads'],
  ['hamstrings', 'hamstrings'],
  ['hamstring', 'hamstrings'],
  ['hams', 'hamstrings'],
  ['glutes', 'glutes'],
  ['glute', 'glutes'],
  ['hip', 'glutes'],
  ['hips', 'glutes'],
  ['calves', 'calves'],
  ['calf', 'calves'],
  ['biceps', 'biceps'],
  ['bicep', 'biceps'],
  ['triceps', 'triceps'],
  ['tricep', 'triceps'],
  ['forearms', 'forearms'],
  ['forearm', 'forearms'],
  ['core', 'core'],
  ['abs', 'core'],
  ['abdominals', 'core'],
  ['traps', 'traps'],
  ['trap', 'traps'],
  ['neck', 'neck'],
  ['full_body', 'full_body'],
  ['full body', 'full_body'],
  ['fullbody', 'full_body'],
]);

export const MOVEMENT_ALIAS_TO_CANONICAL = new Map([
  ['push', 'push'],
  ['pull', 'pull'],
  ['squat', 'squat'],
  ['hinge', 'hinge'],
  ['lunge', 'lunge'],
  ['carry', 'carry'],
  ['isolation', 'isolation'],
  ['plyometric', 'plyometric'],
  ['plyo', 'plyometric'],
  ['rotation', 'rotation'],
  ['rotational', 'rotation'],
  ['other', 'other'],
]);

/** Raw equipment label / slug → canonical equipment_primary slug. */
export const EQUIPMENT_ALIAS_TO_PRIMARY = new Map([
  ['barbell', 'barbell'],
  ['dumbbell', 'dumbbell'],
  ['db', 'dumbbell'],
  ['kettlebell', 'kettlebell'],
  ['kb', 'kettlebell'],
  ['cable', 'cable'],
  ['machine', 'machine'],
  ['bodyweight', 'bodyweight'],
  ['bw', 'bodyweight'],
  ['band', 'band'],
  ['bands', 'band'],
  ['trx', 'trx'],
  ['suspension', 'trx'],
  ['medicine ball', 'medicine_ball'],
  ['medicine_ball', 'medicine_ball'],
  ['med ball', 'medicine_ball'],
  ['ez bar', 'ez_bar'],
  ['ez_bar', 'ez_bar'],
  ['ez-bar', 'ez_bar'],
  ['smith machine', 'smith_machine'],
  ['smith_machine', 'smith_machine'],
  ['smith', 'smith_machine'],
  ['other', 'other'],
]);

/** equipment_primary → equipment_category */
export const EQUIPMENT_CATEGORY_BY_PRIMARY = {
  bodyweight: 'bodyweight',
  barbell: 'free_weights',
  dumbbell: 'free_weights',
  kettlebell: 'free_weights',
  ez_bar: 'free_weights',
  smith_machine: 'free_weights',
  cable: 'cable',
  machine: 'machine',
  band: 'bands',
  trx: 'suspension',
  medicine_ball: 'free_weights',
  other: 'mixed',
};

export const TAG_ALIAS_TO_CANONICAL = new Map([
  ['compound', 'compound'],
  ['isolation', 'isolation'],
  ['unilateral', 'unilateral'],
  ['bilateral', 'bilateral'],
  ['machine_preferred', 'machine_preferred'],
  ['time_efficient', 'time_efficient'],
  ['skill_intensive', 'skill_intensive'],
]);

export const PROGRAM_ROLE_ALIAS = new Map([
  ['main_lift', 'main_lift'],
  ['main lift', 'main_lift'],
  ['main', 'main_lift'],
  ['secondary', 'secondary'],
  ['accessory', 'accessory'],
  ['warmup', 'warmup'],
  ['warm-up', 'warmup'],
  ['finisher', 'finisher'],
  ['cardio', 'cardio'],
  ['mobility', 'mobility'],
  ['prep', 'prep'],
  ['recovery', 'recovery'],
]);

export const GOAL_ALIAS = new Map([
  ['fat_loss', 'fat_loss'],
  ['fat loss', 'fat_loss'],
  ['muscle_gain', 'muscle_gain'],
  ['muscle gain', 'muscle_gain'],
  ['hypertrophy', 'hypertrophy'],
  ['strength', 'strength'],
  ['power', 'power'],
  ['endurance', 'endurance'],
  ['mobility', 'mobility'],
  ['general_fitness', 'general_fitness'],
  ['general fitness', 'general_fitness'],
  ['sport_specific', 'sport_specific'],
  ['sport specific', 'sport_specific'],
  ['competition_prep', 'competition_prep'],
  ['competition prep', 'competition_prep'],
]);

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** @returns {string|null} */
export function normalizeMuscle(value) {
  const key = normalizeText(value).replace(/ /g, '_');
  const direct = MUSCLE_ALIAS_TO_CANONICAL.get(key) || MUSCLE_ALIAS_TO_CANONICAL.get(normalizeText(value));
  if (direct && MUSCLE_SET.has(direct)) return direct;
  if (MUSCLE_SET.has(key)) return key;
  return null;
}

/** @returns {string|null} */
export function normalizeMovementPattern(value) {
  const key = normalizeText(value).replace(/ /g, '_');
  const mapped = MOVEMENT_ALIAS_TO_CANONICAL.get(key) || MOVEMENT_ALIAS_TO_CANONICAL.get(normalizeText(value));
  if (mapped && MOVEMENT_SET.has(mapped)) return mapped;
  if (MOVEMENT_SET.has(key)) return key;
  return null;
}

/** @returns {string|null} */
export function normalizeEquipmentPrimary(value) {
  const raw = normalizeText(value);
  const underscored = raw.replace(/ /g, '_');
  const mapped =
    EQUIPMENT_ALIAS_TO_PRIMARY.get(raw) ||
    EQUIPMENT_ALIAS_TO_PRIMARY.get(underscored) ||
    (EQUIP_PRIMARY_SET.has(underscored) ? underscored : null);
  if (mapped && EQUIP_PRIMARY_SET.has(mapped)) return mapped;
  return null;
}

/** Pick first mappable equipment from a list; default other. */
export function pickPrimaryEquipmentFromList(equipment = []) {
  const arr = Array.isArray(equipment) ? equipment : [];
  for (const e of arr) {
    const p = normalizeEquipmentPrimary(e);
    if (p) return p;
  }
  return 'other';
}

export function deriveEquipmentCategory(equipmentPrimary) {
  const p = normalizeEquipmentPrimary(equipmentPrimary) || 'other';
  return EQUIPMENT_CATEGORY_BY_PRIMARY[p] || 'mixed';
}

function filterAllowed(arr, allowedSet) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  const seen = new Set();
  for (const v of arr) {
    const s = typeof v === 'string' ? v.trim() : '';
    if (!s || !allowedSet.has(s) || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function normalizeTagToken(value) {
  const key = normalizeText(value).replace(/ /g, '_');
  const mapped = TAG_ALIAS_TO_CANONICAL.get(key) || (TAGS_SET.has(key) ? key : null);
  return mapped && TAGS_SET.has(mapped) ? mapped : null;
}

function normalizeProgramRoleToken(value) {
  const nt = normalizeText(value);
  const key = nt.replace(/ /g, '_');
  const mapped = PROGRAM_ROLE_ALIAS.get(nt) || PROGRAM_ROLE_ALIAS.get(key) || key;
  return ROLES_SET.has(mapped) ? mapped : null;
}

function normalizeGoalToken(value) {
  const nt = normalizeText(value);
  const key = nt.replace(/ /g, '_');
  const mapped = GOAL_ALIAS.get(nt) || GOAL_ALIAS.get(key) || key;
  return GOALS_SET.has(mapped) ? mapped : null;
}

function normalizeSessionToken(value) {
  const key = normalizeText(value).replace(/ /g, '_');
  return SESSION_SET.has(key) ? key : null;
}

/**
 * Sanitize an exercise_library row for insert/update. Unknown enum values are dropped; muscles use normalization.
 * @param {Record<string, unknown>} row
 * @returns {Record<string, unknown>}
 */
export function sanitizeExerciseLibraryPayload(row) {
  if (!row || typeof row !== 'object') return {};
  const out = { ...row };

  const pm = out.primary_muscle != null ? normalizeMuscle(out.primary_muscle) : null;
  out.primary_muscle = pm;

  out.primary_muscles = filterAllowed(
    (Array.isArray(out.primary_muscles) ? out.primary_muscles : []).map((m) => normalizeMuscle(m)).filter(Boolean),
    MUSCLE_SET
  );
  if (out.primary_muscles.length === 0 && pm) out.primary_muscles = [pm];

  out.secondary_muscles = filterAllowed(
    (Array.isArray(out.secondary_muscles) ? out.secondary_muscles : []).map((m) => normalizeMuscle(m)).filter(Boolean),
    MUSCLE_SET
  );
  out.stabilizer_muscles = filterAllowed(
    (Array.isArray(out.stabilizer_muscles) ? out.stabilizer_muscles : []).map((m) => normalizeMuscle(m)).filter(Boolean),
    MUSCLE_SET
  );

  const mp = out.movement_pattern != null ? normalizeMovementPattern(out.movement_pattern) : null;
  out.movement_pattern = mp;

  const ep = out.equipment_primary != null ? normalizeEquipmentPrimary(out.equipment_primary) : null;
  const epResolved = ep || pickPrimaryEquipmentFromList(out.equipment);
  out.equipment_primary = epResolved || 'other';

  const equipList = Array.isArray(out.equipment) ? out.equipment : [];
  const normalizedEquip = equipList.map((e) => normalizeEquipmentPrimary(e)).filter(Boolean);
  out.equipment = [...new Set(normalizedEquip.length ? normalizedEquip : [out.equipment_primary])];

  out.equipment_secondary = filterAllowed(
    Array.isArray(out.equipment_secondary) ? out.equipment_secondary.map((e) => normalizeEquipmentPrimary(e)).filter(Boolean) : [],
    EQUIP_PRIMARY_SET
  ).filter((e) => e !== out.equipment_primary);

  const cat = out.equipment_category != null ? normalizeText(String(out.equipment_category)).replace(/ /g, '_') : null;
  out.equipment_category = EQUIP_CAT_SET.has(cat) ? cat : deriveEquipmentCategory(out.equipment_primary);

  out.program_roles = filterAllowed(
    (Array.isArray(out.program_roles) ? out.program_roles : []).map((r) => normalizeProgramRoleToken(r)).filter(Boolean),
    ROLES_SET
  );

  out.best_for_goals = filterAllowed(
    (Array.isArray(out.best_for_goals) ? out.best_for_goals : []).map((g) => normalizeGoalToken(g)).filter(Boolean),
    GOALS_SET
  );

  out.best_in_session_window = filterAllowed(
    (Array.isArray(out.best_in_session_window) ? out.best_in_session_window : []).map((s) => normalizeSessionToken(s)).filter(Boolean),
    SESSION_SET
  );

  out.gym_context_tags = filterAllowed(
    Array.isArray(out.gym_context_tags)
      ? out.gym_context_tags.map((t) => normalizeText(String(t)).replace(/ /g, '_')).filter((t) => GYM_SET.has(t))
      : [],
    GYM_SET
  );
  out.body_context_tags = filterAllowed(
    Array.isArray(out.body_context_tags)
      ? out.body_context_tags.map((t) => normalizeText(String(t)).replace(/ /g, '_')).filter((t) => BODY_CTX_SET.has(t))
      : [],
    BODY_CTX_SET
  );
  out.prep_context_tags = filterAllowed(
    Array.isArray(out.prep_context_tags)
      ? out.prep_context_tags.map((t) => normalizeText(String(t)).replace(/ /g, '_')).filter((t) => PREP_CTX_SET.has(t))
      : [],
    PREP_CTX_SET
  );

  out.tags = filterAllowed(
    (Array.isArray(out.tags) ? out.tags : []).map((t) => normalizeTagToken(t)).filter(Boolean),
    TAGS_SET
  );

  const diff = normalizeText(out.difficulty);
  out.difficulty = ATLAS_DIFFICULTY.includes(diff) ? diff : 'intermediate';

  const et = normalizeText(out.exercise_type).replace(/ /g, '_');
  out.exercise_type = ATLAS_EXERCISE_TYPE.includes(et) ? et : 'accessory';

  const sk = normalizeText(out.skill_requirement);
  out.skill_requirement = ATLAS_SKILL_REQUIREMENT.includes(sk) ? sk : 'low';

  const fc = normalizeText(out.fatigue_cost);
  out.fatigue_cost = ATLAS_FATIGUE_COST.includes(fc) ? fc : 'moderate';

  const sd = normalizeText(out.stability_demand);
  out.stability_demand = ATLAS_STABILITY_DEMAND.includes(sd) ? sd : 'moderate';

  const lp = normalizeText(out.loading_profile).replace(/ /g, '_');
  out.loading_profile = ATLAS_LOADING_PROFILE.includes(lp) ? lp : 'loadable';

  const ut = normalizeText(out.unilateral_type).replace(/ /g, '_');
  out.unilateral_type = ATLAS_UNILATERAL_TYPE.includes(ut) ? ut : 'bilateral';

  const bp = normalizeText(out.body_position).replace(/ /g, '_');
  out.body_position = ATLAS_BODY_POSITION.includes(bp) ? bp : 'standing';

  const st = normalizeText(out.status);
  out.status = ATLAS_LIBRARY_STATUS.includes(st) ? st : 'active';

  return out;
}

/**
 * @param {Record<string, unknown>} row
 * @returns {{ ok: boolean, errors: string[], sanitized: Record<string, unknown> }}
 */
export function validateExerciseLibraryPayload(row) {
  const errors = [];
  const sanitized = sanitizeExerciseLibraryPayload(row);
  if (!sanitized.name || !String(sanitized.name).trim()) errors.push('name is required');
  if (sanitized.movement_pattern != null && !MOVEMENT_SET.has(sanitized.movement_pattern)) {
    errors.push('invalid movement_pattern');
  }
  if (sanitized.primary_muscle != null && !MUSCLE_SET.has(sanitized.primary_muscle)) {
    errors.push('invalid primary_muscle');
  }
  if (!EQUIP_PRIMARY_SET.has(sanitized.equipment_primary)) errors.push('invalid equipment_primary');
  return { ok: errors.length === 0, errors, sanitized };
}

export const MOVEMENT_LABELS = Object.fromEntries(
  ATLAS_MOVEMENT_PATTERNS.map((k) => [k, k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())])
);

export const MUSCLE_LABELS = Object.fromEntries(
  ATLAS_MUSCLES.map((k) => [k, k === 'full_body' ? 'Full body' : k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())])
);

export const EQUIPMENT_PRIMARY_LABELS = Object.fromEntries(
  ATLAS_EQUIPMENT_PRIMARY.map((k) => [
    k,
    k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  ])
);
