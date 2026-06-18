/**
 * Current coach scope id for sandbox/selectors. Set by Auth when user loads.
 * Default aligns with demo coach in `AuthContext` (`local-coach`).
 */

let currentTrainerId = 'local-coach';

export function getCurrentTrainerId() {
  return currentTrainerId;
}

export function setCurrentTrainerId(id) {
  currentTrainerId = id == null || id === '' ? 'local-coach' : String(id);
}
