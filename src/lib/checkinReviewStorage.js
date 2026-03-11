/**
 * Persist check-in reviewed state so needsReview can be treated as false in the app.
 */
const PREFIX = 'atlas_checkin_reviewed_';
const PREFIX_AT = 'atlas_checkin_reviewed_at_';

export function getCheckinReviewed(checkinId) {
  if (!checkinId) return false;
  try {
    return localStorage.getItem(PREFIX + checkinId) === 'true';
  } catch (e) {
    return false;
  }
}

/** ISO string when the check-in was marked reviewed, or null if not stored. */
export function getCheckinReviewedAt(checkinId) {
  if (!checkinId) return null;
  try {
    return localStorage.getItem(PREFIX_AT + checkinId);
  } catch (e) {
    return null;
  }
}

export function setCheckinReviewed(checkinId, reviewedAt = new Date().toISOString()) {
  if (!checkinId) return;
  try {
    localStorage.setItem(PREFIX + checkinId, 'true');
    localStorage.setItem(PREFIX_AT + checkinId, reviewedAt);
  } catch (e) {}
}
