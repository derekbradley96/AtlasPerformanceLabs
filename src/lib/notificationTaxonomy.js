/**
 * Smart notification taxonomy: categories, priorities, and push cadence (retention, not spam).
 */

/** @typedef {'action_required' | 'engagement' | 'insights'} NotificationCategory */

export const NOTIFICATION_CATEGORIES = {
  ACTION_REQUIRED: 'action_required',
  ENGAGEMENT: 'engagement',
  INSIGHTS: 'insights',
};

/** Display order in bell + full page (high → lower urgency in product terms). */
export const CATEGORY_ORDER = [
  NOTIFICATION_CATEGORIES.ACTION_REQUIRED,
  NOTIFICATION_CATEGORIES.ENGAGEMENT,
  NOTIFICATION_CATEGORIES.INSIGHTS,
];

/** Section titles for UI */
export const CATEGORY_LABELS = {
  action_required: 'Action required',
  engagement: 'Messages',
  insights: 'Insights',
};

/** Push delivery strategy per category */
export const PUSH_STRATEGY = {
  action_required: 'instant',
  engagement: 'grouped',
  insights: 'scheduled',
};

/** Map DB type → category (must match SQL insert_notification_for_recipient defaults). */
const TYPE_TO_CATEGORY = {
  checkin_review: NOTIFICATION_CATEGORIES.ACTION_REQUIRED,
  checkin_due: NOTIFICATION_CATEGORIES.ACTION_REQUIRED,
  checkin_overdue: NOTIFICATION_CATEGORIES.ACTION_REQUIRED,
  checkin_submitted: NOTIFICATION_CATEGORIES.ACTION_REQUIRED,
  pose_check_submitted: NOTIFICATION_CATEGORIES.ACTION_REQUIRED,
  client_flag_created: NOTIFICATION_CATEGORIES.ACTION_REQUIRED,
  billing_failed: NOTIFICATION_CATEGORIES.ACTION_REQUIRED,
  payment_due: NOTIFICATION_CATEGORIES.ACTION_REQUIRED,
  payment_issue: NOTIFICATION_CATEGORIES.ACTION_REQUIRED,
  at_risk_client: NOTIFICATION_CATEGORIES.ACTION_REQUIRED,
  program_update: NOTIFICATION_CATEGORIES.ACTION_REQUIRED,
  message_received: NOTIFICATION_CATEGORIES.ENGAGEMENT,
  message_reply: NOTIFICATION_CATEGORIES.ENGAGEMENT,
  coach_alert: NOTIFICATION_CATEGORIES.ACTION_REQUIRED,
  habit_due: NOTIFICATION_CATEGORIES.ENGAGEMENT,
  habit_streak: NOTIFICATION_CATEGORIES.ENGAGEMENT,
  peak_week_update: NOTIFICATION_CATEGORIES.ENGAGEMENT,
  missed_session: NOTIFICATION_CATEGORIES.INSIGHTS,
  progress_insight: NOTIFICATION_CATEGORIES.INSIGHTS,
  upgrade_prompt: NOTIFICATION_CATEGORIES.INSIGHTS,
  adherence_drop: NOTIFICATION_CATEGORIES.INSIGHTS,
  inactivity: NOTIFICATION_CATEGORIES.INSIGHTS,
  review_summary: NOTIFICATION_CATEGORIES.INSIGHTS,
  retention_nudge: NOTIFICATION_CATEGORIES.INSIGHTS,
  automation: NOTIFICATION_CATEGORIES.INSIGHTS,
};

/**
 * @param {string | null | undefined} type
 * @param {string | null | undefined} categoryFromRow
 * @returns {NotificationCategory}
 */
export function getCategoryForType(type, categoryFromRow) {
  if (categoryFromRow && TYPE_TO_CATEGORY[categoryFromRow] === undefined && CATEGORY_LABELS[categoryFromRow]) {
    return /** @type {NotificationCategory} */ (categoryFromRow);
  }
  if (categoryFromRow && TYPE_TO_CATEGORY[categoryFromRow] !== undefined) {
    return /** @type {NotificationCategory} */ (categoryFromRow);
  }
  const t = type && String(type).trim();
  if (t && TYPE_TO_CATEGORY[t]) return TYPE_TO_CATEGORY[t];
  return NOTIFICATION_CATEGORIES.ENGAGEMENT;
}

/**
 * @param {string | null | undefined} category
 * @returns {number} Sort key (lower = higher priority in mixed lists)
 */
export function categorySortKey(category) {
  const idx = CATEGORY_ORDER.indexOf(category);
  return idx === -1 ? 99 : idx;
}

/**
 * @param {string | null | undefined} category
 * @returns {'instant'|'grouped'|'scheduled'}
 */
export function getPushStrategyForCategory(category) {
  const c = category && String(category).trim();
  if (c === NOTIFICATION_CATEGORIES.ACTION_REQUIRED) return 'instant';
  if (c === NOTIFICATION_CATEGORIES.INSIGHTS) return 'scheduled';
  return 'grouped';
}

/**
 * Group notifications by category for sectioned UI.
 * @param {Array<{ category?: string, type?: string }>} items
 * @returns {Record<string, typeof items>}
 */
export function groupNotificationsByCategory(items) {
  /** @type {Record<string, typeof items>} */
  const out = {
    action_required: [],
    engagement: [],
    insights: [],
  };
  if (!Array.isArray(items)) return out;
  const sorted = [...items].sort((a, b) => {
    const ta = new Date(a?.created_at || 0).getTime();
    const tb = new Date(b?.created_at || 0).getTime();
    return tb - ta;
  });
  for (const n of sorted) {
    const cat = getCategoryForType(n?.type, n?.category);
    if (!out[cat]) out[cat] = [];
    out[cat].push(n);
  }
  return out;
}
