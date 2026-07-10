function parseCsvLine(line) {
  const result = [];
  let inQuotes = false;
  let current = '';
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function toNum(val) {
  const n = Number(String(val || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function isValidDate(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str);
}

function parseDate(str) {
  if (str.includes('/')) {
    const [m, d, y] = str.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return str;
}

export function parseMFPCsv(csvText) {
  const lines = String(csvText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line);
  const meals = [];

  for (const line of lines) {
    if (
      line.startsWith('Date')
      || line.startsWith('Totals')
      || line.startsWith('Daily Totals')
      || !line.trim()
    ) {
      continue;
    }

    const cols = parseCsvLine(line);
    if (cols.length < 8) continue;

    const [date, meal, calories, carbs, fat, protein, , , foodName] = cols;
    if (!date || !isValidDate(date)) continue;

    const mealTypeLower = String(meal || '').toLowerCase();
    const meal_type =
      mealTypeLower.includes('breakfast') ? 'breakfast'
      : mealTypeLower.includes('lunch') ? 'lunch'
      : mealTypeLower.includes('dinner') ? 'dinner'
      : mealTypeLower.includes('snack') ? 'snack'
      : 'other';

    meals.push({
      log_date: parseDate(date),
      meal_type,
      food_name: String(foodName || meal || 'Food').trim(),
      calories: toNum(calories),
      carbs_g: toNum(carbs),
      fats_g: toNum(fat),
      protein_g: toNum(protein),
      source: 'mfp_import',
    });
  }

  return meals;
}

export async function importMFPMealsToAtlas({
  supabase,
  csvText,
  profileId,
  clientId,
  onProgress,
  onComplete,
  onError,
}) {
  try {
    const meals = parseMFPCsv(csvText);
    if (!meals.length) {
      onError?.(
        'No meal data found in this file. Make sure you exported your Food Diary from MyFitnessPal (not the Nutrition Report).'
      );
      return;
    }

    // Dedupe in app code, not via ON CONFLICT: meal_logs has no unique index on
    // (profile_id, log_date, meal_type, food_name) — an upsert on those columns
    // errors 42P10, which used to fail the whole import silently. And a blanket
    // unique index would wrongly block logging the same food twice in a day via
    // the normal meal logger. So we fetch the existing rows in range and skip
    // exact matches (re-import safe) before a plain insert.
    const ownerColumn = clientId ? 'client_id' : 'profile_id';
    const ownerValue = clientId || profileId;
    if (!ownerValue) {
      onError?.('Sign in before importing.');
      return;
    }

    const dates = meals.map((m) => m.log_date).filter(Boolean).sort();
    const dedupeKey = (m) => `${m.log_date}|${m.meal_type}|${String(m.food_name || '').toLowerCase()}`;
    const existingKeys = new Set();
    if (dates.length) {
      const { data: existing } = await supabase
        .from('meal_logs')
        .select('log_date, meal_type, food_name')
        .eq(ownerColumn, ownerValue)
        .gte('log_date', dates[0])
        .lte('log_date', dates[dates.length - 1]);
      for (const row of existing || []) existingKeys.add(dedupeKey(row));
    }

    const seen = new Set();
    const toInsert = [];
    let skipped = 0;
    for (const m of meals) {
      const key = dedupeKey(m);
      if (existingKeys.has(key) || seen.has(key)) {
        skipped += 1;
        continue;
      }
      seen.add(key);
      toInsert.push({ ...m, profile_id: profileId || null, client_id: clientId || null });
    }

    const BATCH = 50;
    let imported = 0;
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const slice = toInsert.slice(i, i + BATCH);
      const { error } = await supabase.from('meal_logs').insert(slice);
      if (error) {
        skipped += slice.length;
      } else {
        imported += slice.length;
      }
      onProgress?.(Math.min(100, Math.round(((i + slice.length) / Math.max(1, toInsert.length)) * 100)));
    }
    onProgress?.(100);

    onComplete?.({ imported, skipped, total: meals.length });
  } catch (e) {
    onError?.(e?.message || 'Import failed — please check your file.');
  }
}
