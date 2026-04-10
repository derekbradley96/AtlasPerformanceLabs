import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

function isSchemaMissingError(error) {
  const m = String(error?.message || '');
  return /prep_precision|prep_peak|schema cache|PGRST204|PGRST205/i.test(m);
}

function todayLocalDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function daysAgoDateString(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

// --- Client (coach–client) ---

export async function fetchClientPrepPrecision(clientId) {
  if (!hasSupabase || !clientId) return null;
  const sb = getSupabase();
  const { data, error } = await sb.from('client_prep_precision').select('*').eq('client_id', clientId).maybeSingle();
  if (error) {
    if (isSchemaMissingError(error)) return null;
    throw new Error(error.message);
  }
  return data ?? null;
}

/**
 * Coach upsert — does not touch nutrition_plans macro columns.
 * @param {object} row
 */
export async function upsertClientPrepPrecision(row) {
  if (!hasSupabase || !row?.client_id) return null;
  const sb = getSupabase();
  const payload = {
    ...row,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await sb.from('client_prep_precision').upsert(payload, { onConflict: 'client_id' }).select().single();
  if (error) {
    if (isSchemaMissingError(error)) return null;
    throw new Error(error.message);
  }
  return data;
}

export async function fetchClientPrepPrecisionDaily(clientId, dayDate) {
  if (!hasSupabase || !clientId || !dayDate) return null;
  const sb = getSupabase();
  const { data, error } = await sb
    .from('client_prep_precision_daily')
    .select('*')
    .eq('client_id', clientId)
    .eq('day_date', dayDate)
    .maybeSingle();
  if (error) {
    if (isSchemaMissingError(error)) return null;
    throw new Error(error.message);
  }
  return data ?? null;
}

export async function upsertClientPrepPrecisionDaily({ clientId, dayDate, water_actual_ml, sodium_actual_mg }) {
  if (!hasSupabase || !clientId || !dayDate) return null;
  const sb = getSupabase();
  const { data, error } = await sb
    .from('client_prep_precision_daily')
    .upsert(
      {
        client_id: clientId,
        day_date: dayDate,
        water_actual_ml: water_actual_ml ?? null,
        sodium_actual_mg: sodium_actual_mg ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id,day_date' }
    )
    .select()
    .single();
  if (error) {
    if (isSchemaMissingError(error)) return null;
    throw new Error(error.message);
  }
  return data;
}

export async function fetchClientPrepPrecisionDailyRange(clientId, fromDate, toDate) {
  if (!hasSupabase || !clientId) return [];
  const sb = getSupabase();
  const { data, error } = await sb
    .from('client_prep_precision_daily')
    .select('*')
    .eq('client_id', clientId)
    .gte('day_date', fromDate)
    .lte('day_date', toDate)
    .order('day_date', { ascending: true });
  if (error) {
    if (isSchemaMissingError(error)) return [];
    throw new Error(error.message);
  }
  return Array.isArray(data) ? data : [];
}

export async function listPrepPeakOverrides(clientId, { includeRevoked = false } = {}) {
  if (!hasSupabase || !clientId) return [];
  const sb = getSupabase();
  let q = sb.from('prep_peak_overrides').select('*').eq('client_id', clientId).order('valid_from', { ascending: false });
  if (!includeRevoked) q = q.is('revoked_at', null);
  const { data, error } = await q;
  if (error) {
    if (isSchemaMissingError(error)) return [];
    throw new Error(error.message);
  }
  return Array.isArray(data) ? data : [];
}

export async function insertPrepPeakOverride({
  clientId,
  valid_from,
  valid_to,
  label,
  overrides,
}) {
  if (!hasSupabase || !clientId) return null;
  const sb = getSupabase();
  const { data, error } = await sb
    .from('prep_peak_overrides')
    .insert({
      client_id: clientId,
      valid_from,
      valid_to,
      label: label || 'Peak week override',
      overrides: overrides && typeof overrides === 'object' ? overrides : {},
    })
    .select()
    .single();
  if (error) {
    if (isSchemaMissingError(error)) return null;
    throw new Error(error.message);
  }
  return data;
}

export async function revokePrepPeakOverride(overrideId) {
  if (!hasSupabase || !overrideId) return null;
  const sb = getSupabase();
  const { data, error } = await sb
    .from('prep_peak_overrides')
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', overrideId)
    .select()
    .single();
  if (error) {
    if (isSchemaMissingError(error)) return null;
    throw new Error(error.message);
  }
  return data;
}

// --- Personal (light) ---

export async function fetchPersonalPrepPrecision(userId) {
  if (!hasSupabase || !userId) return null;
  const sb = getSupabase();
  const { data, error } = await sb.from('personal_prep_precision').select('*').eq('user_id', userId).maybeSingle();
  if (error) {
    if (isSchemaMissingError(error)) return null;
    throw new Error(error.message);
  }
  return data ?? null;
}

export async function upsertPersonalPrepPrecision(row) {
  if (!hasSupabase || !row?.user_id) return null;
  const sb = getSupabase();
  const { data, error } = await sb
    .from('personal_prep_precision')
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) {
    if (isSchemaMissingError(error)) return null;
    throw new Error(error.message);
  }
  return data;
}

export async function fetchPersonalPrepPrecisionDaily(userId, dayDate) {
  if (!hasSupabase || !userId || !dayDate) return null;
  const sb = getSupabase();
  const { data, error } = await sb
    .from('personal_prep_precision_daily')
    .select('*')
    .eq('user_id', userId)
    .eq('day_date', dayDate)
    .maybeSingle();
  if (error) {
    if (isSchemaMissingError(error)) return null;
    throw new Error(error.message);
  }
  return data ?? null;
}

export async function upsertPersonalPrepPrecisionDaily({ userId, dayDate, water_actual_ml, sodium_actual_mg }) {
  if (!hasSupabase || !userId || !dayDate) return null;
  const sb = getSupabase();
  const { data, error } = await sb
    .from('personal_prep_precision_daily')
    .upsert(
      {
        user_id: userId,
        day_date: dayDate,
        water_actual_ml: water_actual_ml ?? null,
        sodium_actual_mg: sodium_actual_mg ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,day_date' }
    )
    .select()
    .single();
  if (error) {
    if (isSchemaMissingError(error)) return null;
    throw new Error(error.message);
  }
  return data;
}

export async function fetchPersonalPrepPrecisionDailyRange(userId, fromDate, toDate) {
  if (!hasSupabase || !userId) return [];
  const sb = getSupabase();
  const { data, error } = await sb
    .from('personal_prep_precision_daily')
    .select('*')
    .eq('user_id', userId)
    .gte('day_date', fromDate)
    .lte('day_date', toDate)
    .order('day_date', { ascending: true });
  if (error) {
    if (isSchemaMissingError(error)) return [];
    throw new Error(error.message);
  }
  return Array.isArray(data) ? data : [];
}

/**
 * Active override for "today" (local): not revoked, date range includes today.
 */
export function pickActiveOverrideForDate(overrides, isoDate) {
  if (!Array.isArray(overrides) || !isoDate) return null;
  return (
    overrides.find((o) => {
      if (o?.revoked_at) return false;
      const from = String(o?.valid_from || '');
      const to = String(o?.valid_to || '');
      return from && to && isoDate >= from && isoDate <= to;
    }) ?? null
  );
}

/**
 * Merge base precision row with optional active override patch (display only).
 * @param {object|null} base
 * @param {object|null} overrideRow
 */
export function effectivePrepPrecisionForDay(base, overrideRow) {
  const patch = overrideRow?.overrides && typeof overrideRow.overrides === 'object' ? overrideRow.overrides : {};
  if (!base && !Object.keys(patch).length) return null;
  const merged = { ...(base || {}), ...patch };
  if (overrideRow?.label) merged._active_override_label = overrideRow.label;
  if (overrideRow?.id) merged._active_override_id = overrideRow.id;
  return merged;
}

export function summarizeVarianceToTarget(dailies, key, target) {
  const t = Number(target);
  if (!Number.isFinite(t) || t <= 0 || !Array.isArray(dailies) || !dailies.length) return null;
  const deltas = [];
  for (const d of dailies) {
    const v = Number(d?.[key]);
    if (!Number.isFinite(v)) continue;
    deltas.push(Math.abs(v - t));
  }
  if (!deltas.length) return null;
  const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  return { avgDelta: avg, daysCounted: deltas.length };
}

export { todayLocalDateString, daysAgoDateString };
