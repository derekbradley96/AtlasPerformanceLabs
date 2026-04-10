/**
 * Canonical coach routes for review flows (queue builders + deep links stay aligned).
 *
 * Mental model (three surfaces only):
 * 1. Global queue — `/review-center` — prioritized triage list; optional `?filter=` and `?sort=`.
 * 2. Review next — `/review-global` — one item at a time from the queue; `?done=1` when empty/clear.
 * 3. Per-client — `/clients/:clientId/review-center` — that client’s review feed; optional `?filter=` (checkin|posing|photo).
 *
 * Legacy alias: `/global-review` → redirect to (1) or (2) depending on query (see GlobalReviewRedirect).
 */

/** Global triage queue (unified v_coach_review_queue + merged items). */
export const REVIEW_QUEUE_PATH = '/review-center';

/** Single-item “review next” flow (URL name is historical; behaviour is “next in queue”). */
export const REVIEW_NEXT_PATH = '/review-global';

/** Shown on GlobalReview when the “next” stack is finished. */
export const REVIEW_NEXT_DONE_PARAM = 'done';

/**
 * Map legacy Closeout / old Global Review filter keys to ReviewCenterQueuePage ?filter= values.
 * @param {string | null | undefined} raw
 * @returns {string | null} null = show all (no filter query)
 */
export function normalizeReviewQueueFilterParam(raw) {
  if (raw == null || raw === '' || String(raw).toLowerCase() === 'all') return null;
  const s = String(raw).trim().toLowerCase();
  const aliases = {
    reviews: 'checkins',
    review: 'checkins',
    comp_prep: 'posing',
    payments: 'billing',
    payment: 'billing',
    retention: 'at_risk',
    checkin: 'checkins',
    pose_check: 'posing',
    adaptive_recommendation: 'training_adjustments',
    leads: null,
  };
  if (Object.prototype.hasOwnProperty.call(aliases, s)) {
    return aliases[s];
  }
  return s;
}

/**
 * Build global queue URL with optional filter/sort (filter is normalized; null/omitted = all).
 * @param {{ filter?: string | null, sort?: string | null }} [opts]
 */
export function buildReviewQueueUrl(opts = {}) {
  const { filter, sort } = opts;
  const params = new URLSearchParams();
  const f = normalizeReviewQueueFilterParam(filter);
  if (f) params.set('filter', f);
  if (sort && String(sort) !== '' && sort !== 'priority') params.set('sort', String(sort));
  const qs = params.toString();
  return qs ? `${REVIEW_QUEUE_PATH}?${qs}` : REVIEW_QUEUE_PATH;
}

/** “All clear” / finished stack for review-next flow. */
export function buildReviewNextDoneUrl() {
  return `${REVIEW_NEXT_PATH}?${REVIEW_NEXT_DONE_PARAM}=1`;
}

/** @param {string} checkinId */
/** @param {string | null | undefined} clientId */
export function buildCoachCheckinReviewUrl(checkinId, clientId) {
  if (!checkinId) return REVIEW_QUEUE_PATH;
  const base = `/review-center/checkins/${encodeURIComponent(checkinId)}`;
  return clientId ? `${base}?clientId=${encodeURIComponent(clientId)}` : base;
}
