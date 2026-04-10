/**
 * Trigger in-app notifications from key platform events.
 * Cross-user delivery uses insert_notification_for_recipient RPC (RLS-safe).
 */

import { createNotification, insertNotificationForRecipient } from '@/lib/notifications';

function getTimeTag(now = new Date()) {
  const h = now.getHours();
  if (h < 11) return 'morning';
  if (h < 17) return 'midday';
  return 'evening';
}

/**
 * Client submitted check-in → notify coach (in-app + instant push).
 */
export async function notifyCoachCheckinSubmitted(coachProfileId, clientId, checkinId) {
  if (!coachProfileId) return;
  const rowId = await insertNotificationForRecipient(
    coachProfileId,
    'checkin_review',
    'Check-in submitted',
    'A client submitted a check-in for review.',
    { client_id: clientId ?? null, checkin_id: checkinId ?? null },
    checkinId || null,
    { cooldownMinutes: 30, maxPerDay: 30, dedupeKey: `checkin_review_${checkinId || clientId || 'x'}`, timingTag: 'immediate' }
  );
  if (rowId) {
    try {
      const { triggerActionRequiredPush } = await import('@/services/pushAlertService');
      await triggerActionRequiredPush(coachProfileId, 'Check-in submitted', 'A client submitted a check-in for review.', {
        type: 'checkin_review',
        client_id: clientId,
        checkin_id: checkinId,
      });
    } catch (_) {}
  }
}

/**
 * Coach or client sent a message → notify recipient (in-app + grouped push).
 * @param {string} [threadClientId] — clients.id for coach deep link /messages/:clientId
 */
export async function notifyMessageReceived(recipientProfileId, threadId, preview, senderRole, threadClientId = null) {
  if (!recipientProfileId) return;
  const title = senderRole === 'coach' ? 'New message from coach' : 'New message';
  const message = preview
    ? `New message: ${String(preview).slice(0, 60)}${String(preview).length > 60 ? '…' : ''}`
    : 'You have a new message.';
  const rowId = await insertNotificationForRecipient(
    recipientProfileId,
    'message_received',
    title,
    message,
    {
      thread_id: threadId ?? null,
      client_id: threadClientId ?? null,
    },
    threadId || null,
    { cooldownMinutes: 10, maxPerDay: 60, dedupeKey: `message_${threadId || recipientProfileId}`, timingTag: 'immediate' }
  );
  if (rowId) {
    try {
      const { triggerMessagePush } = await import('@/services/pushAlertService');
      await triggerMessagePush(recipientProfileId, senderRole, preview, {
        thread_id: threadId,
        client_id: threadClientId,
      });
    } catch (_) {}
  }
}

/**
 * Habit missed → remind client (in-app; insight-style push throttled).
 */
export async function notifyClientHabitMissed(clientProfileId, habitId) {
  if (!clientProfileId) return;
  const timingTag = getTimeTag();
  const created = await createNotification(
    clientProfileId,
    'habit_due',
    'Habit reminder',
    "Don't forget today's habits.",
    { habit_id: habitId ?? null },
    { entityId: habitId || null, cooldownMinutes: 240, maxPerDay: 4, dedupeKey: `habit_due_${habitId || 'general'}`, timingTag }
  );
  if (created) {
    try {
      const { triggerInsightPush } = await import('@/services/pushAlertService');
      await triggerInsightPush(clientProfileId, 'Habit reminder', "Don't forget today's habits.", {
        type: 'habit_due',
      });
    } catch (_) {}
  }
}

/**
 * Peak week updated → notify client.
 */
export async function notifyClientPeakWeekUpdated(clientProfileId, peakWeekId) {
  if (!clientProfileId) return;
  await createNotification(
    clientProfileId,
    'peak_week_update',
    'Peak week',
    'Peak week updated.',
    { peak_week_id: peakWeekId ?? null },
    { entityId: peakWeekId || null, cooldownMinutes: 120, maxPerDay: 6, dedupeKey: `peak_week_update_${peakWeekId || 'x'}`, timingTag: 'immediate' }
  );
}

/**
 * Day -N instructions available → notify client (competition prep).
 */
export async function notifyClientPeakWeekDayReady(clientProfileId, dayNumber, peakWeekId) {
  if (!clientProfileId) return;
  const dayLabel = Number.isInteger(dayNumber) ? `Day ${dayNumber}` : 'Day';
  await createNotification(
    clientProfileId,
    'peak_week_update',
    'Peak week',
    `${dayLabel} instructions available.`,
    { peak_week_id: peakWeekId ?? null, day_number: dayNumber ?? null },
    { entityId: peakWeekId || null, cooldownMinutes: 180, maxPerDay: 6, dedupeKey: `peak_week_day_${peakWeekId || 'x'}_${dayNumber || 'x'}`, timingTag: 'morning' }
  );
}

/**
 * Peak week check-in required → notify client.
 */
export async function notifyClientPeakWeekCheckinRequired(clientProfileId, peakWeekId) {
  if (!clientProfileId) return;
  await createNotification(
    clientProfileId,
    'peak_week_update',
    'Peak week',
    'Peak week check-in required.',
    { peak_week_id: peakWeekId ?? null },
    { entityId: peakWeekId || null, cooldownMinutes: 360, maxPerDay: 3, dedupeKey: `peak_week_checkin_${peakWeekId || 'x'}`, timingTag: 'evening' }
  );
}

/**
 * Payment overdue → notify coach (in-app + instant push).
 */
export async function notifyCoachPaymentOverdue(coachProfileId, clientId) {
  if (!coachProfileId) return;
  const rowId = await insertNotificationForRecipient(
    coachProfileId,
    'payment_issue',
    'Payment issue',
    "A client's payment is overdue.",
    { client_id: clientId ?? null },
    clientId || null,
    { cooldownMinutes: 480, maxPerDay: 10, dedupeKey: `payment_issue_${clientId || 'x'}`, timingTag: 'immediate' }
  );
  if (rowId) {
    try {
      const { triggerActionRequiredPush } = await import('@/services/pushAlertService');
      await triggerActionRequiredPush(coachProfileId, 'Payment issue', "A client's payment is overdue.", {
        type: 'payment_issue',
        client_id: clientId,
      });
    } catch (_) {}
  }
}

export async function notifyClientMissedSession(clientProfileId, clientId = null) {
  if (!clientProfileId) return;
  const timingTag = getTimeTag();
  const created = await createNotification(
    clientProfileId,
    'missed_session',
    'Session still open',
    'You missed your planned session. A short workout today keeps momentum moving.',
    { client_id: clientId ?? null },
    { cooldownMinutes: 360, maxPerDay: 2, dedupeKey: `missed_session_${clientId || clientProfileId}`, timingTag }
  );
  if (created) {
    try {
      const { triggerInsightPush } = await import('@/services/pushAlertService');
      await triggerInsightPush(clientProfileId, 'Session still open', 'A short workout today keeps momentum moving.', {
        type: 'missed_session',
        client_id: clientId ?? '',
      });
    } catch (_) {}
  }
}

export async function notifyClientStreakMilestone(clientProfileId, streakDays, clientId = null) {
  if (!clientProfileId || !Number.isFinite(Number(streakDays))) return;
  const days = Math.max(1, Math.round(Number(streakDays)));
  const created = await createNotification(
    clientProfileId,
    'habit_streak',
    'Streak milestone',
    `${days}-day streak. Keep the streak alive today.`,
    { streak_days: days, client_id: clientId ?? null },
    { cooldownMinutes: 720, maxPerDay: 1, dedupeKey: `streak_${days}_${clientId || clientProfileId}`, timingTag: 'evening' }
  );
  if (created) {
    try {
      const { triggerInsightPush } = await import('@/services/pushAlertService');
      await triggerInsightPush(clientProfileId, 'Streak milestone', `${days}-day streak. Keep the streak alive today.`, {
        type: 'habit_streak',
        streak_days: String(days),
      });
    } catch (_) {}
  }
}

export async function notifyCoachAtRiskAlert(coachProfileId, clientId, riskReason = 'Client flagged as at risk') {
  if (!coachProfileId) return;
  const rowId = await insertNotificationForRecipient(
    coachProfileId,
    'coach_alert',
    'At-risk client alert',
    riskReason,
    { client_id: clientId ?? null, risk_reason: riskReason },
    clientId || null,
    { cooldownMinutes: 120, maxPerDay: 24, dedupeKey: `coach_alert_${clientId || 'x'}_${riskReason}`, timingTag: 'immediate' }
  );
  if (rowId) {
    try {
      const { triggerActionRequiredPush } = await import('@/services/pushAlertService');
      await triggerActionRequiredPush(coachProfileId, 'At-risk client alert', riskReason, {
        type: 'coach_alert',
        client_id: clientId ?? '',
      });
    } catch (_) {}
  }
}
