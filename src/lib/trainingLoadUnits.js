/**
 * Training load units only (barbell, dumbbells, machines).
 * Canonical storage: kilograms in workout_session_sets.weight_done and program payloads.
 * Never use st/lb here — independent of body-metric bodyweight_unit.
 */

import { kgToLb, lbToKg } from '@/lib/bodyMeasurementUnits';
import { defaultLoadUnitForLocale } from '@/lib/localeUnitDefaults';

/** @typedef {'kg'|'lb'} LoadUnit */

export const LOAD_UNITS = /** @type {const} */ (['kg', 'lb']);

/** @param {unknown} u @returns {LoadUnit} */
export function normalizeLoadUnit(u) {
  const s = String(u || 'kg').toLowerCase();
  return s === 'lb' ? 'lb' : 'kg';
}

/**
 * Viewer preference: DB load_unit if set, else locale default.
 * @param {{ load_unit?: string | null } | null | undefined} profileRow
 * @param {string | undefined | null} [localeHint]
 */
export function resolveViewerLoadUnit(profileRow, localeHint) {
  const raw = profileRow?.load_unit;
  if (raw != null && String(raw).trim() !== '') return normalizeLoadUnit(raw);
  return defaultLoadUnitForLocale(localeHint);
}

/** @param {unknown} u */
export function loadUnitShortLabel(u) {
  return normalizeLoadUnit(u) === 'lb' ? 'lb' : 'kg';
}

/**
 * @param {number|null|undefined} weightKg
 * @param {unknown} loadUnit
 */
export function formatTrainingLoadKg(weightKg, loadUnit) {
  if (weightKg == null) return '—';
  const kg = Number(weightKg);
  if (!Number.isFinite(kg)) return '—';
  if (normalizeLoadUnit(loadUnit) === 'lb') return `${Math.round(kgToLb(kg) * 10) / 10} lb`;
  return `${Math.round(kg * 10) / 10} kg`;
}

/**
 * Parse a single numeric load the user entered in their training unit → kg for storage.
 * @param {string|number|null|undefined} raw
 * @param {unknown} loadUnit
 * @returns {number|null}
 */
export function parseTrainingLoadInputToKg(raw, loadUnit) {
  const s = String(raw ?? '').trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (normalizeLoadUnit(loadUnit) === 'lb') return lbToKg(n);
  return n;
}

/**
 * Value for a load input (stored kg → display number in viewer unit).
 * @param {number|string|null|undefined} weightKg
 * @param {unknown} loadUnit
 */
export function trainingLoadKgToInputValue(weightKg, loadUnit) {
  if (weightKg == null || weightKg === '') return '';
  const kg = Number(weightKg);
  if (!Number.isFinite(kg)) return '';
  if (normalizeLoadUnit(loadUnit) === 'lb') return String(Math.round(kgToLb(kg) * 10) / 10);
  const rounded = Math.round(kg * 10) / 10;
  return String(rounded);
}
