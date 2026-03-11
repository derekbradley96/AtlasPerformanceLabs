/**
 * In-memory session flags for Global Review auto-route (trainer only).
 * - sessionHasAutoRoutedToGlobalReview: set true after first redirect so we don't hijack again.
 * - sessionSkipGlobalReview: set true when user taps Back from Global Review; no re-route until restart.
 */

let sessionHasAutoRoutedToGlobalReview = false;
let sessionSkipGlobalReview = false;

export function hasAutoRoutedToGlobalReview() {
  return sessionHasAutoRoutedToGlobalReview;
}

export function isSessionSkipGlobalReview() {
  return sessionSkipGlobalReview;
}

export function markAutoRoutedToGlobalReview() {
  sessionHasAutoRoutedToGlobalReview = true;
}

export function setSessionSkipGlobalReviewTrue() {
  sessionSkipGlobalReview = true;
}

/**
 * Should we auto-redirect trainer to /review-global?
 * Only when: trainer_auto_open_review === true, active items exist, first time this session, user hasn't tapped Back.
 * @param {boolean} hasActiveReviewItems
 * @param {boolean} [trainerAutoOpenReview=true] - from getTrainerAutoOpenReview()
 * @returns {boolean}
 */
export function shouldAutoRouteToGlobalReview(hasActiveReviewItems, trainerAutoOpenReview = true) {
  if (!hasActiveReviewItems) return false;
  if (trainerAutoOpenReview !== true) return false;
  if (sessionSkipGlobalReview) return false;
  if (sessionHasAutoRoutedToGlobalReview) return false;
  return true;
}
