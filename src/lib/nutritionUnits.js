/**
 * Nutrition unit system — independent of body metrics (bodyMeasurementUnits) and training loads (trainingLoadUnits).
 * Macros stay in grams; calories stay kcal. Food portions normalize to grams (solids) or ml (liquids) when possible.
 */

const OZ_PER_GRAM = 1 / 28.349523125;
const ML_PER_US_FLOZ = 29.5735295625;

/** @typedef {'g_ml'|'oz_fl_oz'|'household'} FoodQuantityUnit */
/** @typedef {'per_100g'|'per_serving'} NutritionLabelDisplay */
/** @typedef {'ml'|'litres'|'fl_oz'} WaterUnit */
/** @typedef {'mg'|'g'} SodiumUnit */

export const FOOD_QUANTITY_UNIT_IDS = /** @type {const} */ (['g_ml', 'oz_fl_oz', 'household']);
export const NUTRITION_LABEL_DISPLAY_IDS = /** @type {const} */ (['per_100g', 'per_serving']);
export const WATER_UNIT_IDS = /** @type {const} */ (['ml', 'litres', 'fl_oz']);
export const SODIUM_UNIT_IDS = /** @type {const} */ (['mg', 'g']);

/** Approximate ml for common US cooking units (liquids / household volume). */
export const HOUSEHOLD_VOLUME_TO_ML = {
  tsp: 4.92892,
  tbsp: 14.7868,
  cup: 236.588,
  floz: ML_PER_US_FLOZ,
};

export const HOUSEHOLD_UNIT_OPTIONS = [
  { id: 'tsp', label: 'tsp' },
  { id: 'tbsp', label: 'tbsp' },
  { id: 'cup', label: 'cup' },
  { id: 'piece', label: 'piece' },
  { id: 'slice', label: 'slice' },
  { id: 'scoop', label: 'scoop' },
  { id: 'serving', label: 'serving' },
];

/** @param {unknown} u @returns {FoodQuantityUnit} */
export function normalizeFoodQuantityUnit(u) {
  const s = String(u || 'g_ml').toLowerCase();
  if (s === 'oz_fl_oz' || s === 'ozfloz') return 'oz_fl_oz';
  if (s === 'household') return 'household';
  return 'g_ml';
}

/** @param {unknown} u @returns {NutritionLabelDisplay} */
export function normalizeNutritionLabelDisplay(u) {
  return String(u || 'per_100g').toLowerCase() === 'per_serving' ? 'per_serving' : 'per_100g';
}

/** @param {unknown} u @returns {WaterUnit} */
export function normalizeWaterUnit(u) {
  const s = String(u || 'ml').toLowerCase();
  if (s === 'fl_oz' || s === 'floz') return 'fl_oz';
  if (s === 'litres' || s === 'liter' || s === 'l') return 'litres';
  return 'ml';
}

/** @param {unknown} u @returns {SodiumUnit} */
export function normalizeSodiumUnit(u) {
  return String(u || 'mg').toLowerCase() === 'g' ? 'g' : 'mg';
}

/**
 * @param {string | undefined | null} locale
 * @returns {{ food_quantity_unit: FoodQuantityUnit, nutrition_label_display: NutritionLabelDisplay, water_unit: WaterUnit, sodium_unit: SodiumUnit }}
 */
export function defaultNutritionPrefsForLocale(locale) {
  const t = String(locale || (typeof navigator !== 'undefined' ? navigator.language : '') || 'en').toLowerCase();
  if (t.startsWith('en-us')) {
    return {
      food_quantity_unit: 'oz_fl_oz',
      nutrition_label_display: 'per_serving',
      water_unit: 'fl_oz',
      sodium_unit: 'mg',
    };
  }
  return {
    food_quantity_unit: 'g_ml',
    nutrition_label_display: 'per_100g',
    water_unit: 'litres',
    sodium_unit: 'mg',
  };
}

function localeHint(localeHintArg) {
  return localeHintArg ?? (typeof navigator !== 'undefined' ? navigator.language : undefined);
}

/**
 * @param {{ food_quantity_unit?: string | null } | null | undefined} row
 * @param {string | undefined | null} [localeHintArg]
 */
export function resolveViewerFoodQuantityUnit(row, localeHintArg) {
  const raw = row?.food_quantity_unit;
  if (raw != null && String(raw).trim() !== '') return normalizeFoodQuantityUnit(raw);
  return defaultNutritionPrefsForLocale(localeHint(localeHintArg)).food_quantity_unit;
}

/**
 * @param {{ nutrition_label_display?: string | null } | null | undefined} row
 * @param {string | undefined | null} [localeHintArg]
 */
export function resolveViewerNutritionLabelDisplay(row, localeHintArg) {
  const raw = row?.nutrition_label_display;
  if (raw != null && String(raw).trim() !== '') return normalizeNutritionLabelDisplay(raw);
  return defaultNutritionPrefsForLocale(localeHint(localeHintArg)).nutrition_label_display;
}

/**
 * @param {{ water_unit?: string | null } | null | undefined} row
 * @param {string | undefined | null} [localeHintArg]
 */
export function resolveViewerWaterUnit(row, localeHintArg) {
  const raw = row?.water_unit;
  if (raw != null && String(raw).trim() !== '') return normalizeWaterUnit(raw);
  return defaultNutritionPrefsForLocale(localeHint(localeHintArg)).water_unit;
}

/**
 * @param {{ sodium_unit?: string | null } | null | undefined} row
 * @param {string | undefined | null} [localeHintArg]
 */
export function resolveViewerSodiumUnit(row, localeHintArg) {
  const raw = row?.sodium_unit;
  if (raw != null && String(raw).trim() !== '') return normalizeSodiumUnit(raw);
  return defaultNutritionPrefsForLocale(localeHint(localeHintArg)).sodium_unit;
}

/** @param {number|null|undefined} g */
export function gramsToOuncesMass(g) {
  const n = Number(g);
  if (!Number.isFinite(n)) return 0;
  return n * OZ_PER_GRAM;
}

/** @param {number|null|undefined} oz */
export function ouncesMassToGrams(oz) {
  const n = Number(oz);
  if (!Number.isFinite(n)) return 0;
  return n / OZ_PER_GRAM;
}

/** @param {number|null|undefined} ml */
export function mlToUsFluidOunces(ml) {
  const n = Number(ml);
  if (!Number.isFinite(n)) return 0;
  return n / ML_PER_US_FLOZ;
}

/** @param {number|null|undefined} floz */
export function usFluidOuncesToMl(floz) {
  const n = Number(floz);
  if (!Number.isFinite(n)) return 0;
  return n * ML_PER_US_FLOZ;
}

/**
 * Format water volume (canonical ml) for viewer.
 * @param {number|null|undefined} ml
 * @param {unknown} waterUnit
 */
export function formatWaterVolumeMlForViewer(ml, waterUnit) {
  if (ml == null || !Number.isFinite(Number(ml))) return '—';
  const m = Number(ml);
  const u = normalizeWaterUnit(waterUnit);
  if (u === 'fl_oz') return `${mlToUsFluidOunces(m).toFixed(1)} fl oz`;
  if (u === 'litres') return `${(m / 1000).toFixed(2)} L`;
  return `${Math.round(m)} ml`;
}

/**
 * Format sodium (canonical mg) for viewer.
 * @param {number|null|undefined} mg
 * @param {unknown} sodiumUnit
 */
export function formatSodiumMgForViewer(mg, sodiumUnit) {
  if (mg == null || !Number.isFinite(Number(mg))) return '—';
  const m = Number(mg);
  if (normalizeSodiumUnit(sodiumUnit) === 'g') return `${(m / 1000).toFixed(2)} g`;
  return `${Math.round(m)} mg`;
}

/**
 * Quick-add / manual log: viewer input → canonical portion fields.
 * @param {{
 *   foodQuantityUnit: unknown,
 *   amount: number|string|null|undefined,
 *   entryMode: 'solid'|'liquid',
 *   householdUnit?: string|null,
 *   householdAmount?: number|string|null|undefined,
 * }} p
 * @returns {{ portion_grams: number|null, portion_ml: number|null, household_unit: string|null, household_amount: number|null }}
 */
export function portionFromLoggerInputs(p) {
  const fq = normalizeFoodQuantityUnit(p.foodQuantityUnit);
  const liquid = p.entryMode === 'liquid';

  if (fq === 'household') {
    const hu = String(p.householdUnit || '').toLowerCase() || null;
    const count = Number(p.householdAmount);
    if (!hu || !Number.isFinite(count) || count <= 0) {
      return { portion_grams: null, portion_ml: null, household_unit: null, household_amount: null };
    }
    const mlPer = HOUSEHOLD_VOLUME_TO_ML[hu];
    if (mlPer) {
      return {
        portion_grams: null,
        portion_ml: count * mlPer,
        household_unit: hu,
        household_amount: count,
      };
    }
    return {
      portion_grams: null,
      portion_ml: null,
      household_unit: hu,
      household_amount: count,
    };
  }

  const amt = Number(p.amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return { portion_grams: null, portion_ml: null, household_unit: null, household_amount: null };
  }

  if (fq === 'oz_fl_oz') {
    if (liquid) {
      return {
        portion_grams: null,
        portion_ml: usFluidOuncesToMl(amt),
        household_unit: null,
        household_amount: null,
      };
    }
    return {
      portion_grams: ouncesMassToGrams(amt),
      portion_ml: null,
      household_unit: null,
      household_amount: null,
    };
  }

  if (liquid) {
    return { portion_grams: null, portion_ml: amt, household_unit: null, household_amount: null };
  }
  return { portion_grams: amt, portion_ml: null, household_unit: null, household_amount: null };
}

/**
 * Meal portion line for lists — uses viewer food quantity preference only (not logger's).
 * @param {object} meal
 * @param {{ profileRow?: object | null, localeHint?: string | null }} viewer
 */
export function formatMealPortionLineForViewer(meal, viewer) {
  const row = viewer?.profileRow ?? null;
  const fq = resolveViewerFoodQuantityUnit(row, viewer?.localeHint);
  const name = String(meal?.food_name || '').trim();

  const householdUnit = meal?.household_unit != null ? String(meal.household_unit) : '';
  const householdAmt = meal?.household_amount;
  const hasHousehold =
    householdUnit &&
    householdAmt != null &&
    Number.isFinite(Number(householdAmt)) &&
    Number(householdAmt) > 0;

  if (meal?.portion_ml != null && Number(meal.portion_ml) > 0) {
    const ml = Number(meal.portion_ml);
    let qty;
    if (fq === 'oz_fl_oz') qty = `${mlToUsFluidOunces(ml).toFixed(1)} fl oz`;
    else qty = `${Math.round(ml)} ml`;
    return name ? `${name} · ${qty}` : qty;
  }

  if (meal?.portion_grams != null && Number(meal.portion_grams) > 0) {
    const g = Number(meal.portion_grams);
    let qty;
    if (fq === 'oz_fl_oz') qty = `${gramsToOuncesMass(g).toFixed(1)} oz`;
    else qty = `${Math.round(g)} g`;
    return name ? `${name} · ${qty}` : qty;
  }

  if (fq === 'household' && hasHousehold) {
    const opt = HOUSEHOLD_UNIT_OPTIONS.find((o) => o.id === householdUnit);
    const lbl = opt?.label || householdUnit;
    const line = `${Number(householdAmt)} ${lbl}`;
    return name ? `${name} · ${line}` : line;
  }

  if (hasHousehold) {
    const opt = HOUSEHOLD_UNIT_OPTIONS.find((o) => o.id === householdUnit);
    const lbl = opt?.label || householdUnit;
    const line = `${Number(householdAmt)} ${lbl}`;
    return name ? `${name} · ${line}` : line;
  }

  return '';
}

/** Legacy notes like "chicken - 150g" — show first segment with optional g→oz for viewer. */
export function formatLegacyMealNotesFirstLineForViewer(notes, viewer) {
  const raw = String(notes || '').split('|')[0]?.trim() || '';
  if (!raw) return '';
  const gMatch = raw.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (!gMatch) return raw.replace(/^barcode:\s*/i, '').trim();
  const g = Number(gMatch[1]);
  if (!Number.isFinite(g)) return raw;
  const row = viewer?.profileRow ?? null;
  const fq = resolveViewerFoodQuantityUnit(row, viewer?.localeHint);
  const namePart = raw.replace(/\s*-\s*\d+(?:\.\d+)?\s*g\b/i, '').replace(/^barcode:\s*/i, '').trim();
  const qty = fq === 'oz_fl_oz' ? `${gramsToOuncesMass(g).toFixed(1)} oz` : `${Math.round(g)} g`;
  return namePart ? `${namePart} · ${qty}` : qty;
}

/** Settings UI: food quantity mode */
export const FOOD_QUANTITY_SEGMENT_OPTIONS = [
  { id: 'g_ml', label: 'g / ml' },
  { id: 'oz_fl_oz', label: 'oz / fl oz' },
  { id: 'household', label: 'Household' },
];

export const NUTRITION_LABEL_SEGMENT_OPTIONS = [
  { id: 'per_100g', label: 'Per 100g' },
  { id: 'per_serving', label: 'Per serving' },
];

export const WATER_UNIT_SEGMENT_OPTIONS = [
  { id: 'ml', label: 'ml' },
  { id: 'litres', label: 'Litres' },
  { id: 'fl_oz', label: 'fl oz' },
];

export const SODIUM_UNIT_SEGMENT_OPTIONS = [
  { id: 'mg', label: 'mg' },
  { id: 'g', label: 'g' },
];
