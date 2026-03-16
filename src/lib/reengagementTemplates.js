/**
 * Re-engagement message templates for at-risk clients.
 * Short, coach-like, editable. Use with "Send Nudge" to open thread prefilled or copy to clipboard.
 */

export const REENGAGEMENT_TEMPLATES = {
  missed_checkin:
    "Hey — noticed we haven't had a check-in this week. When you get a sec, drop one in so we can keep you on track.",
  low_momentum:
    "Quick check-in: things have been quiet on your end. No judgment — just want to see how you're doing and if we can adjust anything.",
  streak_broken:
    "Saw your habit streak took a hit. That's totally normal. Ready to lock back in? Tell me what would help.",
  low_habit_adherence:
    "Your habit numbers have dipped a bit. Let's figure out what's getting in the way — reply when you can and we'll tweak as needed.",
  no_workout_recent:
    "Haven't seen a workout from you in a bit. How's your week? If something's in the way, we can adapt the plan.",
};

/**
 * Map reason strings (attention_reason, reasons[]) or Review Center item_type to a template key.
 * @param {string[] | string} reasonsOrItemType - e.g. ['low_momentum', 'streak_broken'] or 'habit_adherence_low'
 * @returns {string} template key or 'low_momentum' as default
 */
export function getReengagementTemplateKey(reasonsOrItemType) {
  const list = Array.isArray(reasonsOrItemType)
    ? reasonsOrItemType
    : [reasonsOrItemType].filter(Boolean);
  const normalized = list.map((r) => (r || '').toString().trim().toLowerCase());
  // Order matters: first match wins
  if (normalized.some((r) => r === 'missed_checkin' || r === 'checkin_overdue' || r === 'no_checkin'))
    return 'missed_checkin';
  if (normalized.some((r) => r === 'low_momentum' || r === 'momentum_low' || r === 'momentum_dropping'))
    return 'low_momentum';
  if (normalized.some((r) => r === 'streak_broken' || r === 'habit_streak_broken'))
    return 'streak_broken';
  if (normalized.some((r) => r === 'low_habit_adherence' || r === 'habit_adherence_low'))
    return 'low_habit_adherence';
  if (normalized.some((r) => r === 'no_workout_recent' || r === 'no_workout' || r === 'no_recent_workout'))
    return 'no_workout_recent';
  // Retention risk reasons from v_client_retention_risk
  if (normalized.some((r) => r === 'days_since_last_checkin_high')) return 'missed_checkin';
  if (normalized.some((r) => r === 'no_workouts_last_7d')) return 'no_workout_recent';
  return 'low_momentum';
}

/**
 * Get the template message for given reasons or item_type.
 * @param {string[] | string} reasonsOrItemType
 * @returns {string}
 */
export function getReengagementTemplate(reasonsOrItemType) {
  const key = getReengagementTemplateKey(reasonsOrItemType);
  return REENGAGEMENT_TEMPLATES[key] ?? REENGAGEMENT_TEMPLATES.low_momentum;
}

/**
 * Send nudge: open message thread with prefilled template, or copy to clipboard and toast.
 * @param {{ clientId: string | null, template: string, navigate?: (path: string, opts?: { state?: object }) => void, toast?: { success: (msg: string) => void } }} opts
 */
export function sendReengagementNudge({ clientId, template, navigate, toast }) {
  const msg = (template || '').trim() || getReengagementTemplate('low_momentum');
  if (clientId && typeof navigate === 'function') {
    navigate(`/messages/${clientId}`, { state: { prefilledMessage: msg } });
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(msg).then(
      () => { if (toast?.success) toast.success('Copied to clipboard'); },
      () => { if (toast?.error) toast.error('Could not copy'); }
    );
  } else if (toast?.success) {
    toast.success('Template ready — open messages and paste.');
  }
}
