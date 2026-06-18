function coerceNum(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function applyOwnerFilter(query, { profileId, clientId }) {
  if (profileId) return query.eq('profile_id', profileId);
  if (clientId) return query.eq('client_id', clientId);
  throw new Error('listMealLogs requires profileId or clientId');
}

const ALLOWED_MEAL_TYPES = new Set(['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout', 'other']);

function normalizeMealType(mealType) {
  const raw = String(mealType || 'other').toLowerCase();
  return ALLOWED_MEAL_TYPES.has(raw) ? raw : 'other';
}

export async function listMealLogs({ supabase, profileId, clientId, logDate }) {
  try {
    if (!supabase) return [];
    let q = supabase.from('meal_logs').select('*');
    q = applyOwnerFilter(q, { profileId, clientId });
    if (logDate) q = q.eq('log_date', logDate);
    const { data, error } = await q.order('logged_at', { ascending: true });
    if (error) throw new Error(error.message || 'Failed to load meal logs');
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[mealLogsService] listMealLogs:', error);
    return [];
  }
}

export async function addMealLog({
  supabase,
  profileId,
  clientId,
  logDate,
  mealType,
  foodName,
  calories,
  protein,
  carbs,
  fats,
  portionGrams,
  portionUnit,
  barcode,
  notes,
  source,
}) {
  try {
    if (!supabase) throw new Error('Supabase unavailable');
    if (!profileId && !clientId) throw new Error('addMealLog requires profileId or clientId');
    const payload = {
      profile_id: profileId ?? null,
      client_id: clientId ?? null,
      log_date: logDate,
      meal_type: normalizeMealType(mealType),
      logged_at: new Date().toISOString(),
      food_name: String(foodName || '').trim(),
      calories: coerceNum(calories),
      protein_g: coerceNum(protein),
      carbs_g: coerceNum(carbs),
      fats_g: coerceNum(fats),
      portion_grams: coerceNum(portionGrams),
      portion_unit: portionUnit || null,
      barcode: barcode || null,
      notes: notes || null,
      source: source || 'manual',
    };
    const { data, error } = await supabase.from('meal_logs').insert(payload).select('*').single();
    if (error) throw new Error(error.message || 'Failed to add meal');
    return data;
  } catch (error) {
    console.error('[mealLogsService] addMealLog:', error);
    return null;
  }
}

export async function updateMealLog({ supabase, id, updates }) {
  try {
    if (!supabase) throw new Error('Supabase unavailable');
    const patch = {};
    const keys = [
      'meal_type',
      'food_name',
      'calories',
      'protein_g',
      'carbs_g',
      'fats_g',
      'notes',
      'portion_grams',
      'portion_unit',
      'barcode',
      'source',
      'logged_at',
      'log_date',
    ];
    for (const k of keys) {
      if (!Object.prototype.hasOwnProperty.call(updates, k)) continue;
      if (k === 'meal_type') {
        patch[k] = normalizeMealType(updates[k]);
        continue;
      }
      if (k === 'calories' || k === 'protein_g' || k === 'carbs_g' || k === 'fats_g' || k === 'portion_grams') {
        patch[k] = coerceNum(updates[k]);
      } else {
        patch[k] = updates[k];
      }
    }

    const { data, error } = await supabase.from('meal_logs').update(patch).eq('id', id).select('*').single();
    if (error) throw new Error(error.message || 'Failed to update meal');
    return data;
  } catch (error) {
    console.error('[mealLogsService] updateMealLog:', error);
    return null;
  }
}

export async function deleteMealLog({ supabase, id }) {
  try {
    if (!supabase) throw new Error('Supabase unavailable');
    const { error } = await supabase.from('meal_logs').delete().eq('id', id);
    if (error) throw new Error(error.message || 'Failed to delete meal');
    return true;
  } catch (error) {
    console.error('[mealLogsService] deleteMealLog:', error);
    return false;
  }
}

export async function getMealLogTotals({ supabase, profileId, clientId, logDate }) {
  try {
    const rows = await listMealLogs({ supabase, profileId, clientId, logDate });
    return rows.reduce(
      (acc, m) => ({
        calories: acc.calories + (Number(m?.calories) || 0),
        protein_g: acc.protein_g + (Number(m?.protein_g) || 0),
        carbs_g: acc.carbs_g + (Number(m?.carbs_g) || 0),
        fats_g: acc.fats_g + (Number(m?.fats_g) || 0),
      }),
      { calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 },
    );
  } catch (error) {
    console.error('[mealLogsService] getMealLogTotals:', error);
    return null;
  }
}

export async function getRecentFoods({ supabase, profileId, clientId, limit = 20, sinceLogDate = null } = {}) {
  try {
    if (!supabase) return [];
    let q = supabase.from('meal_logs').select('*');
    q = applyOwnerFilter(q, { profileId, clientId });
    if (sinceLogDate) q = q.gte('log_date', sinceLogDate);
    const { data, error } = await q.order('logged_at', { ascending: false }).limit(Math.max(50, limit * 5));
    if (error) throw new Error(error.message || 'Failed to load recent foods');
    const byName = new Map();
    for (const row of data || []) {
      const name = String(row?.food_name || '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!byName.has(key)) byName.set(key, row);
      if (byName.size >= limit) break;
    }
    return Array.from(byName.values());
  } catch (error) {
    console.error('[mealLogsService] getRecentFoods:', error);
    return [];
  }
}
