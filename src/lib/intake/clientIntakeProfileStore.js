/**
 * Client profile fields written from approved intake (equipment, injuries, preferences, baselineMetrics, phase).
 * Merged into getClientById so rest of app sees extended client.
 */
const KEY = 'atlas_client_intake_profile';

function load() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(data) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {}
}

/**
 * Get intake-derived profile for a client (equipmentProfile, injuries, preferences, baselineMetrics, phase).
 * @param {string} clientId
 * @returns {{ equipmentProfile?: string[] | null; injuries?: string[] | null; preferences?: string[] | null; baselineMetrics?: Record<string, number> | null; phase?: string | null } | null}
 */
export function getClientIntakeProfile(clientId) {
  const data = load();
  return data[clientId] ?? null;
}

/**
 * Set intake-derived profile (e.g. on Approve). Merges with existing.
 * @param {string} clientId
 * @param {{ equipmentProfile?: string[] | null; injuries?: string[] | null; preferences?: string[] | null; baselineMetrics?: Record<string, number> | null; phase?: string | null }} payload
 */
export function setClientIntakeProfile(clientId, payload) {
  const data = load();
  data[clientId] = { ...(data[clientId] ?? {}), ...payload };
  save(data);
}
