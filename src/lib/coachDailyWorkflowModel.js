/**
 * Coach daily operating flow: priority strip ↔ filtered triage queue ↔ deep links.
 * Strip “open queue” targets `/review-center?filter=…` (global triage), not `/review-global` (review next).
 */

import { normalizeReviewQueueFilterParam, REVIEW_QUEUE_PATH, buildReviewQueueUrl } from './coachReviewRoutes';

/** @typedef {'all'|'needs_attention'|'checkins'|'peak_week'|'unread'|'at_risk'} CoachDailyStripKey */

export const COACH_DAILY_STRIP = Object.freeze([
  { key: 'all', label: 'All', reviewFilter: 'all' },
  { key: 'needs_attention', label: 'Needs attention', reviewFilter: 'critical' },
  { key: 'checkins', label: 'Check-ins', reviewFilter: 'reviews' },
  { key: 'peak_week', label: 'Peak / prep', reviewFilter: 'comp_prep' },
  { key: 'unread', label: 'Unread', reviewFilter: 'messages' },
  { key: 'at_risk', label: 'At risk', reviewFilter: 'retention' },
]);

const AT_RISK_ISSUES = new Set([
  'declining_performance',
  'missed_workout',
  'missed_checkin',
  'low_nutrition_adherence',
  'adjustment_pending',
]);

/**
 * @param {CoachDailyStripKey} stripKey
 * @returns {string} path to global triage queue with optional ?filter=
 */
export function coachDailyStripToReviewQueuePath(stripKey) {
  const row = COACH_DAILY_STRIP.find((s) => s.key === stripKey);
  const filter = row?.reviewFilter ?? 'all';
  if (filter === 'all') return REVIEW_QUEUE_PATH;
  const mapped = normalizeReviewQueueFilterParam(filter);
  if (mapped == null) return REVIEW_QUEUE_PATH;
  return buildReviewQueueUrl({ filter: mapped });
}

/** @deprecated Use coachDailyStripToReviewQueuePath (was wrongly pointed at /review-global). */
export const coachDailyStripToReviewGlobalPath = coachDailyStripToReviewQueuePath;

/**
 * @param {{
 *   workloadQueue: Array<object>,
 *   newCheckinsCount: number,
 *   peakWeekDueCount: number,
 *   unreadThreadCount: number,
 *   atRiskClientCount: number,
 *   showPoseAndPeak: boolean,
 * }} input
 */
export function buildCoachPriorityStripCounts({
  workloadQueue = [],
  newCheckinsCount = 0,
  peakWeekDueCount = 0,
  unreadThreadCount = 0,
  atRiskClientCount = 0,
  showPoseAndPeak = true,
}) {
  const q = Array.isArray(workloadQueue) ? workloadQueue : [];
  const needsAttention = q.filter(
    (i) => i?.priority_label === 'critical' || i?.priority_label === 'today'
  ).length;
  const checkins = Math.max(
    newCheckinsCount,
    q.filter((i) => i?.action_type === 'review_checkin' || i?.issue_type === 'missed_checkin').length
  );
  const unread = Math.max(
    unreadThreadCount,
    q.filter(
      (i) =>
        i?.action_type === 'review_messages'
        || (i?.action_type === 'message_client' && i?.issue_type === 'unread_messages')
    ).length
  );
  const peakPrep = showPoseAndPeak
    ? Math.max(
        Number(peakWeekDueCount) || 0,
        q.filter(
          (i) =>
            i?.action_type === 'open_peak_week'
            || i?.issue_type === 'posing_waiting'
            || i?.action_type === 'review_posing'
        ).length
      )
    : 0;
  const atRisk = Math.max(
    atRiskClientCount,
    q.filter((i) => AT_RISK_ISSUES.has(String(i?.issue_type || ''))).length
  );

  return {
    all: q.length,
    needs_attention: needsAttention,
    checkins,
    peak_week: peakPrep,
    unread,
    at_risk: atRisk,
  };
}

/**
 * @param {Array<object>} workloadQueue
 * @param {CoachDailyStripKey} stripKey
 * @param {{ showPoseAndPeak?: boolean }} [opts]
 */
export function filterCoachWorkloadByStrip(workloadQueue, stripKey, opts = {}) {
  const q = Array.isArray(workloadQueue) ? workloadQueue : [];
  const showPoseAndPeak = opts.showPoseAndPeak !== false;
  if (!stripKey || stripKey === 'all') return q;

  if (stripKey === 'needs_attention') {
    return q.filter((i) => i?.priority_label === 'critical' || i?.priority_label === 'today');
  }
  if (stripKey === 'checkins') {
    return q.filter((i) => i?.action_type === 'review_checkin' || i?.issue_type === 'missed_checkin');
  }
  if (stripKey === 'peak_week') {
    if (!showPoseAndPeak) return [];
    return q.filter(
      (i) =>
        i?.action_type === 'open_peak_week'
        || i?.issue_type === 'posing_waiting'
        || i?.action_type === 'review_posing'
    );
  }
  if (stripKey === 'unread') {
    return q.filter(
      (i) =>
        i?.action_type === 'review_messages'
        || (i?.action_type === 'message_client' && i?.issue_type === 'unread_messages')
    );
  }
  if (stripKey === 'at_risk') {
    return q.filter((i) => AT_RISK_ISSUES.has(String(i?.issue_type || '')));
  }
  return q;
}

/**
 * Human-readable client lane for queue rows (prep vs lifestyle).
 * @param {string|null|undefined} clientId
 * @param {Record<string, { client_type?: string|null, show_date?: string|null }>} journeyById
 */
export function coachQueueClientSegmentLabel(clientId, journeyById) {
  if (!clientId) return 'Roster';
  const j = journeyById?.[clientId];
  const t = String(j?.client_type || '').toLowerCase();
  if (t === 'competition' || t === 'prep' || t === 'contest') return 'Prep';
  if (t === 'transformation' || t === 'lifestyle') return 'Transformation';
  if (j?.show_date) return 'Prep';
  return 'Client';
}

/**
 * Primary navigation for a workload row (triage → client / review / inbox).
 * @param {object} item — row from generateCoachWorkloadQueue
 * @returns {string}
 */
export function getCoachWorkloadNavigatePath(item) {
  const cid = item?.client_id;
  const action = String(item?.action_type || '');
  const payload = item?.source_payload && typeof item.source_payload === 'object' ? item.source_payload : {};

  if (action === 'open_peak_week') return '/peak-week-dashboard';

  if (action === 'open_billing') {
    return cid ? `/clients/${encodeURIComponent(cid)}/billing` : '/earnings';
  }

  if (action === 'review_messages' || (action === 'message_client' && item?.issue_type === 'unread_messages')) {
    return cid ? `/messages/${encodeURIComponent(cid)}` : '/messages';
  }

  if (action === 'review_posing') {
    const mediaId = payload.media_id || payload.pose_check_id || payload.id;
    if (mediaId && cid) {
      return `/comp-prep/review/${encodeURIComponent(mediaId)}?clientId=${encodeURIComponent(cid)}`;
    }
    return cid
      ? `/clients/${encodeURIComponent(cid)}?tab=prep`
      : `${REVIEW_QUEUE_PATH}?filter=${encodeURIComponent(normalizeReviewQueueFilterParam('comp_prep') || 'posing')}`;
  }

  if (action === 'review_checkin') {
    const checkinId = payload.checkin_id || payload.checkinId || payload.id;
    if (checkinId) return `/review-center/checkins/${encodeURIComponent(checkinId)}`;
    return cid
      ? `/clients/${encodeURIComponent(cid)}?tab=checkins`
      : `${REVIEW_QUEUE_PATH}?filter=${encodeURIComponent(normalizeReviewQueueFilterParam('reviews') || 'checkins')}`;
  }

  if (action === 'review_adjustment') {
    return cid ? `/clients/${encodeURIComponent(cid)}` : REVIEW_QUEUE_PATH;
  }

  if (action === 'message_client') {
    return cid ? `/messages/${encodeURIComponent(cid)}` : '/messages';
  }

  return cid ? `/clients/${encodeURIComponent(cid)}` : REVIEW_QUEUE_PATH;
}
