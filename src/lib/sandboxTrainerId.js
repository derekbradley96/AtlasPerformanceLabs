/**
 * Current trainer id for sandbox/selectors. Set by Auth when user loads.
 * Default: local-trainer so app always has a valid trainer for sandbox data.
 */

let currentTrainerId = 'local-trainer';

export function getCurrentTrainerId() {
  return currentTrainerId;
}

export function setCurrentTrainerId(id) {
  currentTrainerId = id == null || id === '' ? 'local-trainer' : String(id);
}
