const ACTION_TYPE_PRIORITY = {
  review_adjustment: 100,
  review_checkin: 96,
  review_posing: 94,
  open_peak_week: 92,
  open_billing: 90,
  message_client: 86,
  review_messages: 84,
  open_client: 78,
};

const ISSUE_PRIORITIES = {
  high_fatigue: 92,
  declining_performance: 89,
  missed_checkin: 86,
  missed_workout: 83,
  low_nutrition_adherence: 78,
  posing_waiting: 88,
  payment_overdue: 90,
  unread_messages: 76,
  peak_week_active: 74,
  adjustment_pending: 91,
};

function toPriorityLabel(score) {
  if (score >= 90) return 'critical';
  if (score >= 75) return 'today';
  return 'soon';
}

function mkItem(base) {
  const score = Math.max(0, Math.min(100, Number(base.priority_score) || 0));
  return {
    client_id: base.client_id || null,
    client_name: base.client_name || 'Client',
    priority_score: score,
    priority_label: toPriorityLabel(score),
    reason_summary: base.reason_summary || 'Needs coach review',
    recommended_action: base.recommended_action || 'Open client',
    action_type: base.action_type || 'open_client',
    issue_type: base.issue_type || 'general',
    source_item_type: base.source_item_type || null,
    source_payload: base.source_payload || null,
  };
}

function sortQueue(items) {
  return [...items].sort((a, b) => {
    const s = (b.priority_score || 0) - (a.priority_score || 0);
    if (s !== 0) return s;
    const ap = (ACTION_TYPE_PRIORITY[b.action_type] || 0) - (ACTION_TYPE_PRIORITY[a.action_type] || 0);
    if (ap !== 0) return ap;
    return String(a.client_name || '').localeCompare(String(b.client_name || ''));
  });
}

function collapseByClientBestAction(items) {
  const globalItems = [];
  const byClient = new Map();
  for (const item of items) {
    if (!item.client_id) {
      globalItems.push(item);
      continue;
    }
    const existing = byClient.get(item.client_id);
    if (!existing) {
      byClient.set(item.client_id, item);
      continue;
    }
    if ((item.priority_score || 0) > (existing.priority_score || 0)) {
      byClient.set(item.client_id, item);
      continue;
    }
    if ((item.priority_score || 0) === (existing.priority_score || 0)) {
      const nextAction = ACTION_TYPE_PRIORITY[item.action_type] || 0;
      const prevAction = ACTION_TYPE_PRIORITY[existing.action_type] || 0;
      if (nextAction > prevAction) byClient.set(item.client_id, item);
    }
  }
  return [...byClient.values(), ...globalItems];
}

export function generateCoachWorkloadQueue({
  reviewItems = [],
  attentionItems = [],
  overdueSubscriptions = [],
  unreadThreads = [],
  poseDue = [],
  poseNew = [],
  peakWeekDueCount = 0,
  progressTrendByClient = {},
}, options = {}) {
  const dedupeByClient = options?.dedupeByClient !== false;
  const out = [];

  for (const item of reviewItems) {
    const t = String(item?.item_type || '').toLowerCase();
    if (t === 'checkin') {
      out.push(mkItem({
        client_id: item.client_id,
        client_name: item.client_name,
        priority_score: ISSUE_PRIORITIES.missed_checkin,
        reason_summary: 'Check-in is waiting for review',
        recommended_action: 'Review check-in',
        action_type: 'review_checkin',
        issue_type: 'missed_checkin',
        source_item_type: t,
        source_payload: item.payload || null,
      }));
    } else if (t === 'pose_check') {
      out.push(mkItem({
        client_id: item.client_id,
        client_name: item.client_name,
        priority_score: ISSUE_PRIORITIES.posing_waiting,
        reason_summary: 'Posing submission is waiting',
        recommended_action: 'Review posing',
        action_type: 'review_posing',
        issue_type: 'posing_waiting',
        source_item_type: t,
        source_payload: item.payload || null,
      }));
    } else if (t === 'billing_overdue') {
      out.push(mkItem({
        client_id: item.client_id,
        client_name: item.client_name,
        priority_score: ISSUE_PRIORITIES.payment_overdue,
        reason_summary: 'Payment is overdue',
        recommended_action: 'Open billing',
        action_type: 'open_billing',
        issue_type: 'payment_overdue',
        source_item_type: t,
        source_payload: item.payload || null,
      }));
    } else if (t === 'adaptive_recommendation') {
      out.push(mkItem({
        client_id: item.client_id,
        client_name: item.client_name,
        priority_score: ISSUE_PRIORITIES.adjustment_pending,
        reason_summary: item?.payload?.reason_summary || 'Training adjustment pending coach approval',
        recommended_action: 'Apply adjustment',
        action_type: 'review_adjustment',
        issue_type: 'adjustment_pending',
        source_item_type: t,
        source_payload: item.payload || null,
      }));
    } else if (t === 'no_workout') {
      out.push(mkItem({
        client_id: item.client_id,
        client_name: item.client_name,
        priority_score: ISSUE_PRIORITIES.missed_workout,
        reason_summary: 'Client missed recent workouts',
        recommended_action: 'Message client',
        action_type: 'message_client',
        issue_type: 'missed_workout',
        source_item_type: t,
        source_payload: item.payload || null,
      }));
    }
  }

  for (const item of attentionItems) {
    const reasons = Array.isArray(item?.attention_reason) ? item.attention_reason.map((r) => String(r)) : [];
    const hasHighFatigue = reasons.includes('high_fatigue');
    const hasLowAdherence = reasons.includes('low_adherence') || reasons.includes('habit_adherence_low');
    const hasDecline = reasons.includes('progress_stalled') || reasons.includes('momentum_dropping') || reasons.includes('low_momentum');
    const strictDecline = progressTrendByClient?.[item?.client_id] || null;
    const hasStrictDecline = Boolean(strictDecline?.isDeclining);
    const hasNoWorkout = reasons.includes('no_workout');
    const hasNoCheckin = reasons.includes('no_checkin') || reasons.includes('missed_checkin_this_week');

    if (hasHighFatigue && (hasDecline || hasStrictDecline)) {
      out.push(mkItem({
        client_id: item.client_id,
        client_name: item.client_name,
        priority_score: ISSUE_PRIORITIES.high_fatigue + (hasStrictDecline ? 3 : 0),
        reason_summary: hasStrictDecline
          ? `High fatigue with measured decline (${strictDecline.deltaLabel})`
          : 'High fatigue with declining performance',
        recommended_action: 'Review adjustment',
        action_type: 'review_adjustment',
        issue_type: 'declining_performance',
      }));
      continue;
    }

    if ((hasNoWorkout && hasLowAdherence) || hasNoCheckin) {
      out.push(mkItem({
        client_id: item.client_id,
        client_name: item.client_name,
        priority_score: Math.max(ISSUE_PRIORITIES.missed_workout, ISSUE_PRIORITIES.missed_checkin),
        reason_summary: hasNoCheckin ? 'Missed check-in' : 'Missed workouts with low adherence',
        recommended_action: 'Message client',
        action_type: 'message_client',
        issue_type: hasNoCheckin ? 'missed_checkin' : 'missed_workout',
      }));
      continue;
    }

    if (hasLowAdherence) {
      out.push(mkItem({
        client_id: item.client_id,
        client_name: item.client_name,
        priority_score: ISSUE_PRIORITIES.low_nutrition_adherence,
        reason_summary: 'Low adherence trend',
        recommended_action: 'Message client',
        action_type: 'message_client',
        issue_type: 'low_nutrition_adherence',
      }));
    }
  }

  for (const row of overdueSubscriptions) {
    out.push(mkItem({
      client_id: row.client_id,
      client_name: row.client_name,
      priority_score: ISSUE_PRIORITIES.payment_overdue,
      reason_summary: `Payment overdue${row.days_overdue ? ` (${row.days_overdue}d)` : ''}`,
      recommended_action: 'Open billing',
      action_type: 'open_billing',
      issue_type: 'payment_overdue',
      source_payload: row,
    }));
  }

  for (const t of unreadThreads) {
    if ((Number(t?.unread_count) || 0) <= 0) continue;
    out.push(mkItem({
      client_id: t.client_id,
      client_name: t.client_name || 'Client',
      priority_score: ISSUE_PRIORITIES.unread_messages,
      reason_summary: `${Number(t.unread_count)} unread message${Number(t.unread_count) === 1 ? '' : 's'}`,
      recommended_action: 'Open messages',
      action_type: 'review_messages',
      issue_type: 'unread_messages',
      source_payload: t,
    }));
  }

  for (const p of poseNew) {
    out.push(mkItem({
      client_id: p.client_id,
      client_name: p.client_name,
      priority_score: ISSUE_PRIORITIES.posing_waiting,
      reason_summary: 'Posing submission waiting',
      recommended_action: 'Review posing',
      action_type: 'review_posing',
      issue_type: 'posing_waiting',
      source_payload: p,
    }));
  }
  for (const p of poseDue) {
    out.push(mkItem({
      client_id: p.id || null,
      client_name: p.name || 'Client',
      priority_score: ISSUE_PRIORITIES.posing_waiting - 4,
      reason_summary: 'Weekly posing submission is due',
      recommended_action: 'Message client',
      action_type: 'message_client',
      issue_type: 'posing_waiting',
      source_payload: p,
    }));
  }

  if (Number(peakWeekDueCount) > 0) {
    out.push(mkItem({
      client_id: null,
      client_name: 'Peak week clients',
      priority_score: ISSUE_PRIORITIES.peak_week_active,
      reason_summary: `${Number(peakWeekDueCount)} active peak week client${Number(peakWeekDueCount) === 1 ? '' : 's'}`,
      recommended_action: 'Open peak week',
      action_type: 'open_peak_week',
      issue_type: 'peak_week_active',
    }));
  }

  const list = dedupeByClient ? collapseByClientBestAction(out) : out;
  return sortQueue(list);
}

export function summarizeCoachWorkload(queue = []) {
  const list = Array.isArray(queue) ? queue : [];
  return {
    critical: list.filter((i) => i.priority_label === 'critical').length,
    today: list.filter((i) => i.priority_label === 'today').length,
    posing: list.filter((i) => i.issue_type === 'posing_waiting').length,
    billing: list.filter((i) => i.issue_type === 'payment_overdue').length,
    needsAttention: list.filter((i) => i.priority_label === 'critical' || i.priority_label === 'today').length,
    onTrack: Math.max(0, [...new Set(list.map((i) => i.client_id).filter(Boolean))].length - list.filter((i) => i.priority_label !== 'soon').length),
    unresolvedAdjustments: list.filter((i) => i.issue_type === 'adjustment_pending').length,
  };
}

export function getPrimaryCtaForWorkloadItem(item) {
  const type = String(item?.action_type || '');
  if (type === 'review_checkin') return 'Review check-in';
  if (type === 'message_client') return 'Message client';
  if (type === 'review_posing') return 'Review posing';
  if (type === 'open_billing') return 'Open billing';
  if (type === 'review_adjustment') return 'Apply adjustment';
  if (type === 'review_messages') return 'Open messages';
  if (type === 'open_peak_week') return 'Open peak week';
  return 'Open client';
}
