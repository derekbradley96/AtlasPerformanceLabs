/**
 * Body metrics only (height, bodyweight, targets, check-ins, progress).
 * Canonical storage: height → cm, bodyweight → kg.
 * Profile columns: height_unit, bodyweight_unit (never use these for bar/load).
 * Legacy column weight_unit is migrated to bodyweight_unit in DB; code accepts both until fully cleared.
 */
import { defaultBodyweightUnitForLocale } from '@/lib/localeUnitDefaults';

/** @typedef {'cm'|'ft_in'|'m'} HeightUnit */
/** @typedef {'kg'|'st_lb'|'lb'} WeightUnit */

export const HEIGHT_UNITS = /** @type {const} */ (['cm', 'ft_in', 'm']);
export const WEIGHT_UNITS = /** @type {const} */ (['kg', 'st_lb', 'lb']);

const LB_PER_STONE = 14;
export const KG_PER_LB = 0.45359237;

/** @param {unknown} u @returns {HeightUnit} */
export function normalizeHeightUnit(u) {
  const s = String(u || 'cm').toLowerCase().replace(/-/g, '_');
  if (s === 'ft_in' || s === 'ftin' || s === 'imperial_height') return 'ft_in';
  if (s === 'm' || s === 'meter' || s === 'meters' || s === 'metres') return 'm';
  return 'cm';
}

/** @param {unknown} u @returns {WeightUnit} */
export function normalizeWeightUnit(u) {
  const s = String(u || 'kg').toLowerCase().replace(/-/g, '_');
  if (s === 'st_lb' || s === 'stlb' || s === 'stone' || s === 'stones') return 'st_lb';
  if (s === 'lb' || s === 'lbs') return 'lb';
  return 'kg';
}

/**
 * Viewer body-metric unit: explicit bodyweight_unit (or legacy weight_unit), else legacy units, else locale default.
 * @param {{ bodyweight_unit?: string | null, weight_unit?: string | null, units?: string | null } | null | undefined} profileRow
 * @param {string | undefined | null} [localeHint]
 */
export function resolveViewerBodyweightUnit(profileRow, localeHint) {
  const raw = profileRow?.bodyweight_unit ?? profileRow?.weight_unit;
  if (raw != null && String(raw).trim() !== '') return normalizeWeightUnit(raw);
  const legacy = profileRow?.units;
  if (legacy != null && String(legacy).trim() !== '') {
    const low = String(legacy).toLowerCase();
    if (low === 'lb' || low === 'lbs') return 'lb';
  }
  return defaultBodyweightUnitForLocale(
    localeHint ?? (typeof navigator !== 'undefined' ? navigator.language : undefined)
  );
}

/** @param {HeightUnit} u */
export function heightUnitShortLabel(u) {
  const n = normalizeHeightUnit(u);
  if (n === 'ft_in') return 'ft/in';
  if (n === 'm') return 'm';
  return 'cm';
}

/** @param {WeightUnit} u */
export function weightUnitShortLabel(u) {
  const n = normalizeWeightUnit(u);
  if (n === 'st_lb') return 'st/lb';
  if (n === 'lb') return 'lb';
  return 'kg';
}

/**
 * @param {number|null|undefined} cm
 * @returns {{ feet: number, inches: number }}
 */
export function cmToFeetInches(cm) {
  const c = Number(cm);
  if (!Number.isFinite(c) || c < 0) return { feet: 0, inches: 0 };
  const totalIn = c / 2.54;
  let feet = Math.floor(totalIn / 12);
  let inches = totalIn - feet * 12;
  inches = Math.round(inches * 10) / 10;
  if (inches >= 12) {
    feet += 1;
    inches -= 12;
  }
  return { feet, inches };
}

/**
 * @param {number|string|null|undefined} feet
 * @param {number|string|null|undefined} inches
 * @returns {number} cm
 */
export function feetInchesToCm(feet, inches) {
  const f = Number(feet);
  const i = Number(inches);
  const ft = Number.isFinite(f) ? f : 0;
  const inch = Number.isFinite(i) ? i : 0;
  return (ft * 12 + inch) * 2.54;
}

/** @param {number|null|undefined} cm */
export function cmToMeters(cm) {
  const c = Number(cm);
  if (!Number.isFinite(c)) return 0;
  return c / 100;
}

/** @param {number|string|null|undefined} m */
export function metersToCm(m) {
  const v = Number(m);
  if (!Number.isFinite(v)) return 0;
  return v * 100;
}

/** @param {number|null|undefined} kg */
export function kgToLb(kg) {
  const k = Number(kg);
  if (!Number.isFinite(k)) return 0;
  return k / KG_PER_LB;
}

/** @param {number|string|null|undefined} lb */
export function lbToKg(lb) {
  const v = Number(lb);
  if (!Number.isFinite(v)) return 0;
  return v * KG_PER_LB;
}

/**
 * @param {number|null|undefined} kg
 * @returns {{ stone: number, pound: number }}
 */
export function kgToStLb(kg) {
  const k = Number(kg);
  if (!Number.isFinite(k) || k <= 0) return { stone: 0, pound: 0 };
  const totalLb = kgToLb(k);
  const stone = Math.floor(totalLb / LB_PER_STONE);
  const pound = Math.round((totalLb - stone * LB_PER_STONE) * 10) / 10;
  return { stone, pound };
}

/**
 * @param {number|string|null|undefined} stone
 * @param {number|string|null|undefined} pound
 */
export function stLbToKg(stone, pound) {
  const st = Number(stone);
  const lb = Number(pound);
  const s = Number.isFinite(st) ? st : 0;
  const p = Number.isFinite(lb) ? lb : 0;
  const totalLb = s * LB_PER_STONE + p;
  return lbToKg(totalLb);
}

/**
 * @param {number|null|undefined} cm
 * @param {unknown} heightUnit
 * @param {{ decimalsM?: number }} [opts]
 */
export function formatHeightForViewer(cm, heightUnit, opts = {}) {
  const u = normalizeHeightUnit(heightUnit);
  const c = Number(cm);
  if (!Number.isFinite(c) || c <= 0) return '—';
  if (u === 'm') {
    const dm = opts.decimalsM ?? 2;
    return `${(c / 100).toFixed(dm)} m`;
  }
  if (u === 'ft_in') {
    const { feet, inches } = cmToFeetInches(c);
    const inchStr = Number.isInteger(inches) ? String(inches) : inches.toFixed(1);
    return `${feet}′${inchStr}″`;
  }
  return `${Math.round(c)} cm`;
}

/**
 * @param {number|null|undefined} kg
 * @param {unknown} weightUnit
 * @param {{ decimalsKg?: number, decimalsLb?: number }} [opts]
 */
export function formatWeightForViewer(kg, weightUnit, opts = {}) {
  const u = normalizeWeightUnit(weightUnit);
  const k = Number(kg);
  if (!Number.isFinite(k) || k <= 0) return '—';
  const dk = opts.decimalsKg ?? 1;
  const dl = opts.decimalsLb ?? 1;
  if (u === 'lb') {
    const lb = kgToLb(k);
    return `${lb.toFixed(dl)} lb`;
  }
  if (u === 'st_lb') {
    const { stone, pound } = kgToStLb(k);
    const pStr = Number.isInteger(pound) ? String(pound) : pound.toFixed(1);
    return `${stone} st ${pStr} lb`;
  }
  return `${k.toFixed(dk)} kg`;
}

/**
 * Split canonical kg into display fields for forms.
 * @param {number|null|undefined} kg
 * @param {unknown} weightUnit
 */
export function weightKgToFormParts(kg, weightUnit) {
  const u = normalizeWeightUnit(weightUnit);
  const k = Number(kg);
  if (!Number.isFinite(k) || k <= 0) {
    if (u === 'st_lb') return { primary: '', secondary: '' };
    return { primary: '' };
  }
  if (u === 'lb') return { primary: String(Math.round(kgToLb(k) * 10) / 10) };
  if (u === 'st_lb') {
    const { stone, pound } = kgToStLb(k);
    return { primary: String(stone), secondary: String(pound) };
  }
  return { primary: String(Math.round(k * 10) / 10) };
}

/**
 * @param {number|null|undefined} cm
 * @param {unknown} heightUnit
 */
export function heightCmToFormParts(cm, heightUnit) {
  const u = normalizeHeightUnit(heightUnit);
  const c = Number(cm);
  if (!Number.isFinite(c) || c <= 0) {
    if (u === 'ft_in') return { primary: '', secondary: '' };
    return { primary: '' };
  }
  if (u === 'm') return { primary: String(Math.round((c / 100) * 1000) / 1000) };
  if (u === 'ft_in') {
    const { feet, inches } = cmToFeetInches(c);
    const inchStr = Number.isInteger(inches) ? String(inches) : String(Math.round(inches * 10) / 10);
    return { primary: String(feet), secondary: inchStr };
  }
  return { primary: String(Math.round(c)) };
}

/**
 * @param {{
 *   heightUnit: unknown,
 *   cmText?: string,
 *   metersText?: string,
 *   feetText?: string,
 *   inchesText?: string,
 * }} p
 * @returns {number|null} cm or null if empty/invalid
 */
export function parseHeightInputsToCm(p) {
  const u = normalizeHeightUnit(p.heightUnit);
  if (u === 'm') {
    const v = String(p.metersText ?? '').trim();
    if (!v) return null;
    const m = Number(v);
    if (!Number.isFinite(m) || m <= 0 || m > 2.72) return null;
    return metersToCm(m);
  }
  if (u === 'ft_in') {
    const ft = String(p.feetText ?? '').trim();
    const inch = String(p.inchesText ?? '').trim();
    if (!ft && !inch) return null;
    const f = ft ? Number(ft) : 0;
    const i = inch ? Number(inch) : 0;
    if (!Number.isFinite(f) || !Number.isFinite(i) || f < 0 || i < 0 || i >= 12) return null;
    const cm = feetInchesToCm(f, i);
    if (!Number.isFinite(cm) || cm <= 0 || cm > 272) return null;
    return cm;
  }
  const v = String(p.cmText ?? '').trim();
  if (!v) return null;
  const cm = Number(v);
  if (!Number.isFinite(cm) || cm <= 0 || cm > 272) return null;
  return cm;
}

/**
 * @param {{
 *   weightUnit: unknown,
 *   kgText?: string,
 *   lbText?: string,
 *   stoneText?: string,
 *   poundText?: string,
 * }} p
 * @returns {number|null} kg
 */
export function parseWeightInputsToKg(p) {
  const u = normalizeWeightUnit(p.weightUnit);
  if (u === 'lb') {
    const v = String(p.lbText ?? '').trim();
    if (!v) return null;
    const lb = Number(v);
    if (!Number.isFinite(lb) || lb <= 0 || lb > 700) return null;
    return lbToKg(lb);
  }
  if (u === 'st_lb') {
    const st = String(p.stoneText ?? '').trim();
    const lb = String(p.poundText ?? '').trim();
    if (!st && !lb) return null;
    const stone = st ? Number(st) : 0;
    const pound = lb ? Number(lb) : 0;
    if (!Number.isFinite(stone) || !Number.isFinite(pound) || stone < 0 || pound < 0 || pound >= LB_PER_STONE) return null;
    const kg = stLbToKg(stone, pound);
    if (!Number.isFinite(kg) || kg <= 0 || kg > 320) return null;
    return kg;
  }
  const v = String(p.kgText ?? '').trim();
  if (!v) return null;
  const kg = Number(v);
  if (!Number.isFinite(kg) || kg <= 0 || kg > 320) return null;
  return kg;
}

/**
 * Map weight series (kg) to display numbers for chart Y values.
 * @param {number} kg
 * @param {unknown} weightUnit
 */
export function weightKgToChartValue(kg, weightUnit) {
  const u = normalizeWeightUnit(weightUnit);
  const k = Number(kg);
  if (!Number.isFinite(k)) return null;
  if (u === 'lb') return kgToLb(k);
  if (u === 'st_lb') return kgToLb(k);
  return k;
}

/** @param {unknown} weightUnit */
export function weightChartAxisLabel(weightUnit) {
  const u = normalizeWeightUnit(weightUnit);
  if (u === 'lb') return 'Weight (lb)';
  if (u === 'st_lb') return 'Weight (lb)';
  return 'Weight (kg)';
}

/** @param {number|null|undefined} deltaKg */
export function formatWeightDeltaKg(deltaKg, weightUnit) {
  if (deltaKg == null) return '—';
  const u = normalizeWeightUnit(weightUnit);
  const d = Number(deltaKg);
  if (!Number.isFinite(d)) return '—';
  if (u === 'lb' || u === 'st_lb') {
    const lb = d / KG_PER_LB;
    return `${lb > 0 ? '+' : ''}${lb.toFixed(1)} lb`;
  }
  return `${d > 0 ? '+' : ''}${d.toFixed(1)} kg`;
}

/** Magnitude of a kg delta in the viewer’s weight unit (no sign). */
export function formatAbsWeightDeltaFromKg(deltaKg, weightUnit) {
  const u = normalizeWeightUnit(weightUnit);
  const mag = Math.abs(Number(deltaKg));
  if (!Number.isFinite(mag)) return '—';
  if (u === 'lb' || u === 'st_lb') return `${(mag / KG_PER_LB).toFixed(1)} lb`;
  return `${mag.toFixed(1)} kg`;
}

/**
 * Resolve profile current_weight to kg (canonical when bodyweight_unit/weight_unit set; else legacy units column).
 * @param {{ current_weight?: number|null, bodyweight_unit?: string|null, weight_unit?: string|null, units?: string|null }|null|undefined} profileRow
 */
export function profileCurrentWeightKg(profileRow) {
  if (!profileRow) return null;
  const bu = profileRow.bodyweight_unit ?? profileRow.weight_unit;
  if (bu != null && bu !== '') {
    const w = Number(profileRow.current_weight);
    return Number.isFinite(w) && w > 0 ? w : null;
  }
  return legacyProfileWeightToKg(profileRow.current_weight, profileRow.units);
}

/** @param {{ target_weight?: number|null, bodyweight_unit?: string|null, weight_unit?: string|null, units?: string|null }|null|undefined} profileRow */
export function profileTargetWeightKg(profileRow) {
  if (!profileRow) return null;
  const bu = profileRow.bodyweight_unit ?? profileRow.weight_unit;
  if (bu != null && bu !== '') {
    const w = Number(profileRow.target_weight);
    return Number.isFinite(w) && w > 0 ? w : null;
  }
  return legacyProfileWeightToKg(profileRow.target_weight, profileRow.units);
}

/**
 * @param {number|null|undefined} weight
 * @param {string|null|undefined} units profiles.units legacy
 */
export function legacyProfileWeightToKg(weight, units) {
  const w = Number(weight);
  if (!Number.isFinite(w) || w <= 0) return null;
  const u = String(units || 'kg').toLowerCase();
  if (u === 'lb' || u === 'lbs' || u === 'imperial') return w * KG_PER_LB;
  return w;
}
