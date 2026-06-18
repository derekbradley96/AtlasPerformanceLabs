/**
 * Client journey / roster lane — separates lifestyle vs prep for integrated coaches.
 * Uses clients.client_type and optional show_date (legacy prep signal).
 */

/** @param {Record<string, unknown> | null | undefined} client */
export function normalizeClientJourneyType(client) {
  if (!client || typeof client !== 'object') return 'transformation';
  const raw = String(client.client_type ?? client.client_journey ?? '')
    .toLowerCase()
    .trim();
  if (raw === 'competition') return 'competition';
  if (raw === 'integrated') return 'integrated';
  if (raw === 'transformation') return 'transformation';
  const hasShow = Boolean(client.show_date ?? client.showDate);
  if (hasShow) return 'competition';
  return 'transformation';
}

/**
 * Prep athlete: active contest prep row (authoritative). Supports DB `is_active` or legacy `status === 'active'`.
 * @param {Record<string, unknown> | null | undefined} client
 */
export function isPrepAthleteFromRow(client) {
  const arr = client?.contest_preps;
  if (Array.isArray(arr)) {
    return arr.some((p) => p?.is_active === true || String(p?.status || '').toLowerCase() === 'active');
  }
  const raw = String(client?.client_type ?? '').toLowerCase().trim();
  const hasShow = Boolean(client?.show_date ?? client?.showDate);
  if (raw === 'competition' || hasShow) return true;
  return false;
}

/**
 * Two-lane bucket for integrated coach UI: "prep" vs "lifestyle".
 * @param {Record<string, unknown> | null | undefined} client
 * @returns {'prep' | 'lifestyle'}
 */
export function journeyRosterBucket(client) {
  if (isPrepAthleteFromRow(client)) return 'prep';
  return 'lifestyle';
}

/** Short label for list row badges (integrated coach clarity). */
export function journeyRosterBadgeLabel(client) {
  const bucket = journeyRosterBucket(client);
  if (bucket === 'prep') return 'Prep';
  const t = normalizeClientJourneyType(client);
  if (t === 'integrated') return 'Hybrid';
  return 'Lifestyle';
}

export const JOURNEY_QUERY_VALUES = /** @type {const} */ (['all', 'lifestyle', 'prep']);
