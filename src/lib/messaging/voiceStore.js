/**
 * IndexedDB storage for voice note blobs. Key format: voice_{clientId}_{timestamp}_{random}
 */

const DB_NAME = 'atlas_voice_store';
const STORE_NAME = 'blobs';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onerror = () => reject(r.error);
    r.onsuccess = () => resolve(r.result);
    r.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
  });
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 11);
}

/**
 * Store a voice blob. Returns key string.
 * @param {Blob} blob
 * @param {string} [clientId] - optional, for key prefix
 * @returns {Promise<string>}
 */
export async function putVoiceBlob(blob, clientId = '') {
  const key = `voice_${clientId}_${Date.now()}_${randomSuffix()}`;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const r = store.put(blob, key);
    r.onsuccess = () => resolve(key);
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Get a voice blob by key.
 * @param {string} key
 * @returns {Promise<Blob|null>}
 */
export async function getVoiceBlob(key) {
  if (!key) return null;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const r = store.get(key);
    r.onsuccess = () => resolve(r.result ?? null);
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Delete a voice blob by key.
 * @param {string} key
 * @returns {Promise<void>}
 */
export async function deleteVoiceBlob(key) {
  if (!key) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}
