/**
 * Persist comp prep client overrides (federation, division, prepPhase, showDate, notes)
 * and client_photos list per client. Uses localStorage key comp_prep.
 */

const KEY = 'comp_prep';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { clients: {}, photos: {} };
  } catch {
    return { clients: {}, photos: {} };
  }
}

function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('compPrepStore save failed', e);
  }
}

/**
 * Get overrides for a client (federation, division, prepPhase, showDate, comp_notes).
 * @param {string} clientId
 * @returns {Record<string, unknown> | null}
 */
export function getCompPrepClientOverrides(clientId) {
  const data = load();
  return data.clients[clientId] ?? null;
}

/**
 * Set comp prep profile for a client.
 * @param {string} clientId
 * @param { { federation?: string | null; division?: string | null; prepPhase?: string | null; showDate?: string | null; comp_notes?: string | null } } payload
 */
export function setCompPrepClient(clientId, payload) {
  const data = load();
  data.clients[clientId] = { ...(data.clients[clientId] ?? {}), ...payload };
  save(data);
}

/**
 * Get full photos list for client (if overridden in store). Otherwise selector uses mockData.
 * @param {string} clientId
 * @returns {Array<{ id: string; client_id: string; type: string; pose_type: string | null; image_url: string; notes: string; created_at: string }> | null}
 */
export function getClientPhotosOverride(clientId) {
  const data = load();
  return data.photos[clientId] ?? null;
}

/**
 * Set photos list for a client (e.g. after add/delete). Replaces any mock photos for this client when present.
 * @param {string} clientId
 * @param {Array<{ id: string; client_id: string; type: string; pose_type?: string | null; image_url: string; notes?: string; created_at: string }>} list
 */
export function setClientPhotos(clientId, list) {
  const data = load();
  data.photos[clientId] = list.map((p) => ({
    id: p.id,
    client_id: clientId,
    type: p.type,
    pose_type: p.pose_type ?? null,
    image_url: p.image_url,
    notes: p.notes ?? '',
    created_at: p.created_at,
  }));
  save(data);
}

/**
 * Add one photo. Merges with existing (store or mock).
 * @param {string} clientId
 * @param { { type: string; pose_type?: string | null; image_url: string; notes?: string } } photo
 * @param { () => Array<{ id: string; client_id: string; type: string; pose_type: string | null; image_url: string; notes: string; created_at: string }> } getExisting - e.g. () => getClientPhotos(clientId) from selector
 */
export function addClientPhoto(clientId, photo, getExisting) {
  const existing = getExisting();
  const newPhoto = {
    id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    client_id: clientId,
    type: photo.type,
    pose_type: photo.pose_type ?? null,
    image_url: photo.image_url,
    notes: photo.notes ?? '',
    created_at: new Date().toISOString(),
  };
  setClientPhotos(clientId, [newPhoto, ...existing]);
  return newPhoto;
}

/**
 * Update a single photo's notes or pose_type.
 */
export function updateClientPhoto(clientId, photoId, updates) {
  const data = load();
  const list = data.photos[clientId] ?? [];
  const idx = list.findIndex((p) => p.id === photoId);
  if (idx === -1) return;
  list[idx] = { ...list[idx], ...updates };
  data.photos[clientId] = list;
  save(data);
}

/**
 * Delete a photo from the list.
 */
export function deleteClientPhoto(clientId, photoId, getExisting) {
  const existing = getExisting();
  setClientPhotos(clientId, existing.filter((p) => p.id !== photoId));
}
