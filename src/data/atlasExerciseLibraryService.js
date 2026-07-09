import { EXERCISES } from '@/data/exercises/exerciseLibrary';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import {
  normalizeMuscle,
  normalizeMovementPattern,
  normalizeEquipmentPrimary,
  pickPrimaryEquipmentFromList,
  deriveEquipmentCategory,
  sanitizeExerciseLibraryPayload,
} from '@/lib/exerciseTaxonomy';

export { sanitizeExerciseLibraryPayload, validateExerciseLibraryPayload } from '@/lib/exerciseTaxonomy';

function db() {
  return hasSupabase ? getSupabase() : null;
}

function normalizeArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v || '').trim()).filter(Boolean);
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function normalizeText(value) {
  return String(value || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function toFlagsFromSlugs(equipmentSlugs = []) {
  const lower = equipmentSlugs.map((e) => String(e || '').toLowerCase());
  return {
    is_bodyweight: lower.includes('bodyweight'),
    is_machine: lower.includes('machine'),
    is_dumbbell: lower.includes('dumbbell'),
    is_barbell: lower.includes('barbell'),
  };
}

function toLibraryRow(exercise) {
  const equipmentRaw = normalizeArray(exercise?.equipment);
  const equipmentSlugs = equipmentRaw.map((e) => normalizeEquipmentPrimary(e)).filter(Boolean);
  const lowerName = String(exercise?.name || '').toLowerCase();
  const movementPattern = normalizeMovementPattern(exercise?.movementPattern);
  const primaryMuscle = normalizeMuscle(exercise?.primaryMuscle);
  const secondaryMuscles = normalizeArray(exercise?.secondaryMuscles)
    .map((m) => normalizeMuscle(m))
    .filter(Boolean);
  const equipmentPrimary = pickPrimaryEquipmentFromList(equipmentRaw);
  const equipmentSecondary = equipmentSlugs.filter((e) => e !== equipmentPrimary);
  const equipmentCategory = deriveEquipmentCategory(equipmentPrimary);
  const tagTokens = normalizeArray(exercise?.tags);
  const tagLower = tagTokens.map((t) => normalizeText(t));
  const compound = tagLower.includes('compound');
  const aliases = [];
  const prepContextTags = [];
  if (tagLower.includes('posing_conditioning') || tagLower.includes('comp_prep')) {
    prepContextTags.push('pre_contest');
  }
  let programRoles = compound ? ['main_lift'] : ['accessory'];
  let exerciseType = compound ? 'compound' : 'accessory';
  if (tagLower.includes('cardio') || tagLower.includes('conditioning')) {
    programRoles = ['cardio'];
    exerciseType = 'cardio';
  }
  if (tagLower.includes('mobility') || tagLower.includes('flexibility') || tagLower.includes('recovery')) {
    programRoles = ['mobility'];
    exerciseType = 'mobility';
  }
  const row = {
    name: String(exercise?.name || '').trim(),
    slug: slugify(exercise?.name),
    display_name: String(exercise?.name || '').trim(),
    aliases,
    status: 'active',
    primary_muscle: primaryMuscle,
    primary_muscles: primaryMuscle ? [primaryMuscle] : [],
    secondary_muscles: secondaryMuscles,
    stabilizer_muscles: [],
    equipment: equipmentSlugs.length ? equipmentSlugs : [equipmentPrimary],
    equipment_primary: equipmentPrimary,
    equipment_secondary: equipmentSecondary,
    equipment_category: equipmentCategory,
    body_position: 'standing',
    movement_pattern: movementPattern,
    difficulty: 'intermediate',
    skill_requirement: 'low',
    fatigue_cost: compound ? 'high' : 'moderate',
    stability_demand: lowerName.includes('single') ? 'high' : 'moderate',
    loading_profile: compound ? 'loadable' : 'limited_load',
    unilateral_type: lowerName.includes('single') ? 'single_side' : 'bilateral',
    exercise_type: exerciseType,
    program_roles: programRoles,
    best_for_goals: ['hypertrophy', 'general_fitness'],
    best_in_session_window: compound ? ['main'] : ['secondary', 'finisher'],
    gym_context_tags: ['commercial_gym'],
    body_context_tags: [],
    prep_context_tags: prepContextTags,
    description: null,
    instructions: null,
    coaching_cues: null,
    substitutions: normalizeArray(exercise?.substitutions),
    tags: tagTokens,
    is_unilateral: lowerName.includes('single') || lowerName.includes('unilateral'),
    source: 'open_seed',
    source_external_id: String(exercise?.id || '').trim() || null,
    ...toFlagsFromSlugs(equipmentSlugs.length ? equipmentSlugs : [equipmentPrimary]),
  };
  return sanitizeExerciseLibraryPayload(row);
}

export function normalizeExternalExerciseRecord(record) {
  const name = String(record?.name || record?.title || '').trim();
  if (!name) return null;
  const aliases = normalizeArray(record?.aliases || record?.alias);
  const primary = normalizeMuscle(record?.primary_muscle || record?.primaryMuscle || record?.muscle);
  const secondary = normalizeArray(record?.secondary_muscles || record?.secondaryMuscles || record?.muscles_secondary)
    .map((m) => normalizeMuscle(m))
    .filter(Boolean);
  const stabilizers = normalizeArray(record?.stabilizer_muscles || record?.stabilizers)
    .map((m) => normalizeMuscle(m))
    .filter(Boolean);
  const equipmentRaw = normalizeArray(record?.equipment || record?.equipment_secondary || []);
  const equipmentPrimaryRaw = record?.equipment_primary || equipmentRaw[0] || null;
  const equipmentAllSlugs = equipmentRaw.map((e) => normalizeEquipmentPrimary(e)).filter(Boolean);
  const equipmentPrimary = normalizeEquipmentPrimary(equipmentPrimaryRaw) || pickPrimaryEquipmentFromList(equipmentRaw);
  const equipmentSecondary = equipmentAllSlugs.filter((e) => e !== equipmentPrimary);
  const movementPattern = normalizeMovementPattern(record?.movement_pattern || record?.movementPattern || record?.pattern);
  const slug = slugify(record?.slug || name);
  const dedupeKey = normalizeText(record?.canonical_name || name);
  const substitutionGroups = {
    close: normalizeArray(record?.close_substitutions),
    broad: normalizeArray(record?.broad_substitutions || record?.substitutions),
    regression: normalizeArray(record?.regressions),
    progression: normalizeArray(record?.progressions),
  };
  const library = sanitizeExerciseLibraryPayload({
    slug,
    name,
    display_name: String(record?.display_name || name),
    aliases,
    source: String(record?.source || 'external_seed'),
    source_external_id: String(record?.source_external_id || record?.id || '').trim() || null,
    status: String(record?.status || 'active'),
    movement_pattern: movementPattern,
    primary_muscle: primary,
    primary_muscles: primary ? [primary] : [],
    secondary_muscles: secondary,
    stabilizer_muscles: stabilizers,
    equipment: [equipmentPrimary, ...equipmentSecondary].filter(Boolean),
    equipment_primary: equipmentPrimary,
    equipment_secondary: equipmentSecondary,
    equipment_category: deriveEquipmentCategory(equipmentPrimary),
    body_position: String(record?.body_position || 'standing'),
    difficulty: String(record?.difficulty || 'intermediate'),
    skill_requirement: String(record?.skill_requirement || 'low'),
    fatigue_cost: String(record?.fatigue_cost || 'moderate'),
    stability_demand: String(record?.stability_demand || 'moderate'),
    loading_profile: String(record?.loading_profile || 'loadable'),
    unilateral_type: String(record?.unilateral_type || 'bilateral'),
    exercise_type: String(record?.exercise_type || 'accessory'),
    program_roles: normalizeArray(record?.program_roles),
    best_for_goals: normalizeArray(record?.best_for_goals),
    best_in_session_window: normalizeArray(record?.best_in_session_window),
    gym_context_tags: normalizeArray(record?.gym_context_tags),
    body_context_tags: normalizeArray(record?.body_context_tags),
    prep_context_tags: normalizeArray(record?.prep_context_tags),
    description: record?.description || null,
    instructions: record?.instructions || null,
    coaching_cues: record?.coaching_cues || null,
    substitutions: substitutionGroups.broad,
    tags: normalizeArray(record?.tags),
    is_unilateral: String(record?.unilateral_type || '').includes('single') || String(name).toLowerCase().includes('single'),
    is_bodyweight: normalizeText(equipmentPrimary) === 'bodyweight',
    is_machine: normalizeText(equipmentPrimary) === 'machine',
    is_dumbbell: normalizeText(equipmentPrimary) === 'dumbbell',
    is_barbell: normalizeText(equipmentPrimary) === 'barbell',
  });
  return {
    dedupeKey,
    substitutionGroups,
    library,
  };
}

export function normalizeExternalExerciseDataset(records = []) {
  const byDedupeKey = new Map();
  for (const raw of records) {
    const normalized = normalizeExternalExerciseRecord(raw);
    if (!normalized?.library?.name) continue;
    const key = normalized.dedupeKey;
    if (!byDedupeKey.has(key)) {
      byDedupeKey.set(key, normalized);
      continue;
    }
    const existing = byDedupeKey.get(key);
    const mergedAliases = [...new Set([...(existing.library.aliases || []), ...(normalized.library.aliases || [])])];
    const mergedTags = [...new Set([...(existing.library.tags || []), ...(normalized.library.tags || [])])];
    const mergedEquipment = [...new Set([...(existing.library.equipment || []), ...(normalized.library.equipment || [])])];
    existing.library.aliases = mergedAliases;
    existing.library.tags = mergedTags;
    existing.library.equipment = mergedEquipment;
    if (!existing.library.source_external_id && normalized.library.source_external_id) {
      existing.library.source_external_id = normalized.library.source_external_id;
    }
    existing.library = sanitizeExerciseLibraryPayload(existing.library);
    byDedupeKey.set(key, existing);
  }
  return [...byDedupeKey.values()];
}

async function upsertAliasesForExercises(supabase, libraryRows) {
  const aliasRows = [];
  for (const row of libraryRows) {
    const aliases = normalizeArray(row.aliases);
    for (const alias of aliases) {
      aliasRows.push({
        exercise_id: row.id,
        alias,
        alias_normalized: normalizeText(alias),
        source: row.source || 'atlas',
      });
    }
  }
  if (!aliasRows.length) return;
  await supabase.from('exercise_aliases').upsert(aliasRows, { onConflict: 'exercise_id,alias_normalized' });
}

async function upsertSubstitutionsForSeed(supabase, libraryRows, seedRows) {
  const byExternalId = new Map();
  for (const row of libraryRows) {
    if (row.source_external_id) byExternalId.set(String(row.source_external_id), row.id);
  }
  const relationRows = [];
  const relationMap = {
    close: 'close',
    broad: 'broad',
    regression: 'regression',
    progression: 'progression',
  };
  for (const seed of seedRows) {
    const currentId = byExternalId.get(String(seed.library.source_external_id || ''));
    if (!currentId) continue;
    for (const [rawKey, relationType] of Object.entries(relationMap)) {
      const sourceIds = normalizeArray(seed?.substitutionGroups?.[rawKey]);
      for (const subExternalId of sourceIds) {
        const subId = byExternalId.get(String(subExternalId || ''));
        if (!subId || subId === currentId) continue;
        relationRows.push({
          exercise_id: currentId,
          substitute_exercise_id: subId,
          relation_type: relationType,
          score: relationType === 'close' ? 0.95 : relationType === 'broad' ? 0.75 : 0.7,
        });
      }
    }
  }
  if (!relationRows.length) return;
  await supabase.from('exercise_substitutions').upsert(relationRows, {
    onConflict: 'exercise_id,substitute_exercise_id,relation_type',
  });
}

export async function ensureAtlasExerciseLibrarySeeded() {
  const supabase = db();
  if (!supabase) return { seeded: false, reason: 'no_supabase' };
  // Skip the full upsert once the catalog is populated — this runs on every
  // builder open, so re-upserting ~130 rows each time is pure waste.
  const { count, error: countError } = await supabase
    .from('exercise_library')
    .select('id', { head: true, count: 'exact' });
  if (!countError && (count ?? 0) > 0) return { seeded: false, reason: 'already_populated' };
  const normalizedRows = EXERCISES.map(toLibraryRow).filter((row) => row.name);
  const rows = normalizeExternalExerciseDataset(normalizedRows).map((x) => sanitizeExerciseLibraryPayload(x.library));
  if (!rows.length) return { seeded: false, reason: 'empty_seed' };
  const { data, error } = await supabase
    .from('exercise_library')
    .upsert(rows, { onConflict: 'name', ignoreDuplicates: false })
    .select('id, slug, source_external_id, aliases, source');
  if (error) return { seeded: false, reason: error.message };
  await upsertAliasesForExercises(supabase, data || []);
  await upsertSubstitutionsForSeed(supabase, data || [], normalizeExternalExerciseDataset(normalizedRows));
  return { seeded: true, count: rows.length, upserted: true };
}

export async function importExternalExerciseDataset(records = [], source = 'external_seed') {
  const supabase = db();
  if (!supabase) return { imported: 0, deduped: 0, errors: ['no_supabase'] };
  const normalized = normalizeExternalExerciseDataset(records);
  if (!normalized.length) return { imported: 0, deduped: 0, errors: [] };
  const rows = normalized.map((n) => sanitizeExerciseLibraryPayload({ ...n.library, source }));
  const { data, error } = await supabase
    .from('exercise_library')
    .upsert(rows, { onConflict: 'slug' })
    .select('id, slug, source_external_id, aliases, source');
  if (error) return { imported: 0, deduped: normalized.length, errors: [error.message] };
  await upsertAliasesForExercises(supabase, data || []);
  await upsertSubstitutionsForSeed(supabase, data || [], normalized);
  return {
    imported: data?.length || 0,
    deduped: normalized.length,
    errors: [],
  };
}

/**
 * Fetch richer exercise rows for deterministic scoring/auto-build workflows.
 */
export async function listAtlasExerciseCandidates({ limit = 500, filters = {} } = {}) {
  const supabase = db();
  if (!supabase) return [];
  const { movementPattern, primaryMuscle, equipmentPrimary } = filters || {};
  let query = supabase
    .from('exercise_library')
    .select(`
      id,name,display_name,slug,status,
      movement_pattern,primary_muscle,primary_muscles,secondary_muscles,stabilizer_muscles,
      equipment,equipment_primary,equipment_secondary,equipment_category,
      difficulty,skill_requirement,fatigue_cost,stability_demand,loading_profile,unilateral_type,
      program_roles,best_for_goals,best_in_session_window,gym_context_tags,body_context_tags,prep_context_tags,
      tags,is_unilateral
    `)
    .eq('status', 'active')
    .limit(Math.max(20, Math.min(1000, Number(limit) || 500)));
  if (movementPattern) query = query.eq('movement_pattern', movementPattern);
  if (primaryMuscle) query = query.eq('primary_muscle', primaryMuscle);
  if (equipmentPrimary) query = query.eq('equipment_primary', equipmentPrimary);
  const { data, error } = await query;
  if (error) return [];
  return data || [];
}

/**
 * @param {{ userId: string, query?: string, limit?: number, filters?: { movementPattern?: string, primaryMuscle?: string, equipmentPrimary?: string } }} opts
 */
export async function searchAtlasExercises({ userId, query = '', limit = 20, filters = {} }) {
  const supabase = db();
  if (!supabase || !userId) return [];
  const rawQ = String(query || '').trim().toLowerCase();
  const safeQ = rawQ.replace(/[%_\\]/g, '');
  const { movementPattern, primaryMuscle, equipmentPrimary } = filters;
  const fetchLimit = Math.max(limit * 4, 40);

  let libraryQuery = supabase
    .from('exercise_library')
    .select('id, name, display_name, slug, aliases, tags, movement_pattern, primary_muscle, equipment_primary');
  if (movementPattern) libraryQuery = libraryQuery.eq('movement_pattern', movementPattern);
  if (primaryMuscle) libraryQuery = libraryQuery.eq('primary_muscle', primaryMuscle);
  if (equipmentPrimary) libraryQuery = libraryQuery.eq('equipment_primary', equipmentPrimary);
  if (safeQ) {
    libraryQuery = libraryQuery.or(`name.ilike.%${safeQ}%,display_name.ilike.%${safeQ}%,slug.ilike.%${safeQ}%`);
  }
  libraryQuery = libraryQuery.limit(fetchLimit);
  const { data: libraryRows } = await libraryQuery;

  const [{ data: aliasExactRows }] = await Promise.all([
    safeQ
      ? supabase
        .from('exercise_aliases')
        .select('exercise_id, alias, alias_normalized')
        .eq('alias_normalized', safeQ)
        .limit(fetchLimit)
      : Promise.resolve({ data: [] }),
  ]);

  let library = libraryRows || [];
  if (safeQ && (aliasExactRows || []).length) {
    const aliasIds = new Set((aliasExactRows || []).map((r) => r.exercise_id));
    const have = new Set(library.map((r) => r.id));
    const missing = [...aliasIds].filter((id) => !have.has(id));
    if (missing.length) {
      let extraQ = supabase
        .from('exercise_library')
        .select('id, name, display_name, slug, aliases, tags, movement_pattern, primary_muscle, equipment_primary')
        .in('id', missing);
      if (movementPattern) extraQ = extraQ.eq('movement_pattern', movementPattern);
      if (primaryMuscle) extraQ = extraQ.eq('primary_muscle', primaryMuscle);
      if (equipmentPrimary) extraQ = extraQ.eq('equipment_primary', equipmentPrimary);
      const { data: extraRows } = await extraQ;
      library = [...library, ...(extraRows || [])];
    }
  }

  if (!library.length) return [];
  const aliasExactIds = new Set((aliasExactRows || []).map((row) => row.exercise_id));

  const libraryIds = library.map((row) => row.id);
  const [{ data: usageRows }, { data: favoriteRows }] = await Promise.all([
    supabase
      .from('exercise_usage')
      .select('exercise_id, last_used_at, usage_count, last_sets, last_reps, last_rest_seconds')
      .eq('user_id', userId)
      .in('exercise_id', libraryIds),
    supabase
      .from('exercise_favorites')
      .select('exercise_id')
      .eq('user_id', userId)
      .in('exercise_id', libraryIds),
  ]);

  const usageById = new Map((usageRows || []).map((row) => [row.exercise_id, row]));
  const favorites = new Set((favoriteRows || []).map((row) => row.exercise_id));

  const rank = (row) => {
    const name = String(row.name || '').toLowerCase();
    const display = String(row.display_name || '').toLowerCase();
    const usage = usageById.get(row.id);
    const favoriteBoost = favorites.has(row.id) ? 1 : 0;
    const recentTs = usage?.last_used_at ? new Date(usage.last_used_at).getTime() : 0;
    const usageCount = Number(usage?.usage_count || 0);
    const aliasExact = aliasExactIds.has(row.id) ? 1 : 0;
    const nameExact = safeQ && (name === safeQ || display === safeQ) ? 1 : 0;
    const prefix = safeQ && name.startsWith(safeQ) ? 1 : 0;
    const includes = safeQ && (name.includes(safeQ) || display.includes(safeQ)) ? 1 : 0;
    return {
      recentTs,
      favoriteBoost,
      aliasExact,
      nameExact,
      usageCount,
      prefix,
      includes,
    };
  };

  const sorted = [...library].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra.recentTs !== rb.recentTs) return rb.recentTs - ra.recentTs;
    if (ra.favoriteBoost !== rb.favoriteBoost) return rb.favoriteBoost - ra.favoriteBoost;
    if (ra.aliasExact !== rb.aliasExact) return rb.aliasExact - ra.aliasExact;
    if (ra.nameExact !== rb.nameExact) return rb.nameExact - ra.nameExact;
    if (ra.prefix !== rb.prefix) return rb.prefix - ra.prefix;
    if (ra.includes !== rb.includes) return rb.includes - ra.includes;
    if (ra.usageCount !== rb.usageCount) return rb.usageCount - ra.usageCount;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });

  return sorted.slice(0, limit).map((row) => ({
    ...row,
    favorite: favorites.has(row.id),
    usage: usageById.get(row.id) || null,
  }));
}

export async function trackExerciseUsage({ userId, exerciseId, sets = null, reps = null, restSeconds = null }) {
  const supabase = db();
  if (!supabase || !userId || !exerciseId) return;
  const { data: existing } = await supabase
    .from('exercise_usage')
    .select('id, usage_count')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .maybeSingle();
  const usage_count = Number(existing?.usage_count || 0) + 1;
  await supabase.from('exercise_usage').upsert({
    user_id: userId,
    exercise_id: exerciseId,
    usage_count,
    last_used_at: new Date().toISOString(),
    last_sets: sets != null ? Number(sets) : null,
    last_reps: reps != null ? String(reps) : null,
    last_rest_seconds: restSeconds != null ? Number(restSeconds) : null,
  }, { onConflict: 'user_id,exercise_id' });
}

export async function trackUsageBatch({ userId, rows = [] }) {
  for (const row of rows) {
    await trackExerciseUsage({
      userId,
      exerciseId: row.exerciseId,
      sets: row.sets,
      reps: row.reps,
      restSeconds: row.restSeconds,
    });
  }
}
