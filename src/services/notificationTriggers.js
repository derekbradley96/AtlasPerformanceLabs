/**
 * Trigger in-app notifications from key platform events.
 * Uses createNotification from @/lib/notifications.
 */

import { createNotification } from '@/lib/notifications';

/**
 * Client submitted check-in → notify coach.
 * @param {string} coachProfileId - profiles.id of the coach
 * @param {string} [clientId] - clients.id for deep link
 * @param {string} [checkinId] - checkins.id for deep link
 */
export async function notifyCoachCheckinSubmitted(coachProfileId, clientId, checkinId) {
  if (!coachProfileId) return;
  await createNotification(
    coachProfileId,
    'checkin_review',
    'Check-in submitted',
    'Client check-in submitted.',
    { client_id: clientId ?? null, checkin_id: checkinId ?? null }
  );
}

/**
 * Coach (or client) sent a message → notify recipient (in-app).
 * Use senderRole to show "New message from coach." when the sender is the coach.
 * @param {string} recipientProfileId - profiles.id of the recipient
 * @param {string} [threadId] - for deep link
 * @param {string} [preview] - short message preview
 * @param {'coach'|'client'} [senderRole] - who sent the message (for title)
 */
export async function notifyMessageReceived(recipientProfileId, threadId, preview, senderRole) {
  if (!recipientProfileId) return;
  const title = senderRole === 'coach' ? 'New message from coach.' : 'New message';
  const message = preview ? `New message: ${String(preview).slice(0, 60)}${preview.length > 60 ? '…' : ''}` : 'You have a new message.';
  await createNotification(
    recipientProfileId,
    'message_received',
    title,
    message,
    { thread_id: threadId ?? null }
  );
}

/**
 * Habit missed → remind client.
 * @param {string} clientProfileId - profiles.id of the client
 * @param {string} [habitId] - client_habits.id
 */
export async function notifyClientHabitMissed(clientProfileId, habitId) {
  if (!clientProfileId) return;
  await createNotification(
    clientProfileId,
    'habit_due',
    'Habit reminder',
    "Don't forget today's habits.",
    { habit_id: habitId ?? null }
  );
}

/**
 * Peak week updated → notify client.
 * @param {string} clientProfileId - profiles.id of the client
 * @param {string} [peakWeekId] - peak_weeks.id for deep link
 */
export async function notifyClientPeakWeekUpdated(clientProfileId, peakWeekId) {
  if (!clientProfileId) return;
  await createNotification(
    clientProfileId,
    'peak_week_update',
    'Peak week',
    'Peak week updated.',
    { peak_week_id: peakWeekId ?? null }
  );
}

/**
 * Day -N instructions available → notify client (competition prep).
 * @param {string} clientProfileId - profiles.id of the client
 * @param {number} dayNumber - e.g. -3 for "Day -3"
 * @param {string} [peakWeekId] - peak_weeks.id for deep link
 */
export async function notifyClientPeakWeekDayReady(clientProfileId, dayNumber, peakWeekId) {
  if (!clientProfileId) return;
  const dayLabel = Number.isInteger(dayNumber) ? `Day ${dayNumber}` : 'Day';
  await createNotification(
    clientProfileId,
    'peak_week_update',
    'Peak week',
    `${dayLabel} instructions available.`,
    { peak_week_id: peakWeekId ?? null, day_number: dayNumber ?? null }
  );
}

/**
 * Peak week check-in required → notify client.
 * @param {string} clientProfileId - profiles.id of the client
 * @param {string} [peakWeekId] - peak_weeks.id for deep link
 */
export async function notifyClientPeakWeekCheckinRequired(clientProfileId, peakWeekId) {
  if (!clientProfileId) return;
  await createNotification(
    clientProfileId,
    'peak_week_update',
    'Peak week',
    'Peak week check-in required.',
    { peak_week_id: peakWeekId ?? null }
  );
}

/**
 * Payment overdue → notify coach.
 * @param {string} coachProfileId - profiles.id of the coach
 * @param {string} [clientId] - clients.id for context
 */
export async function notifyCoachPaymentOverdue(coachProfileId, clientId) {
  if (!coachProfileId) return;
  await createNotification(
    coachProfileId,
    'payment_due',
    'Payment overdue',
    "A client's payment is overdue.",
    { client_id: clientId ?? null }
  );
}
