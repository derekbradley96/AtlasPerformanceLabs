/**
 * Reminder trigger types and default copy for client action reminders.
 * Used by the send-reminders Edge Function and by the app for display.
 * Notifications table: type = one of these keys; title/message can be overridden per insert.
 */

export const REMINDER_TRIGGER_TYPES = [
  'workout_due',
  'workout_evening_reminder',
  'checkin_due',
  'habit_missing',
  'prep_pose_check_due',
  'billing_due',
  'supplement_morning_reminder',
  'supplement_evening_reminder',
  'supplement_missed_reminder',
];

/** Default title and message per trigger type. */
export const REMINDER_TRIGGERS = {
  workout_due: {
    type: 'workout_due',
    defaultTitle: 'Workout due today',
    defaultMessage: "You have a workout scheduled for today. Log it when you're done to keep your progress on track.",
  },
  workout_evening_reminder: {
    type: 'workout_evening_reminder',
    defaultTitle: 'Workout still waiting',
    defaultMessage: "Workout still waiting. Let's keep the streak going.",
  },
  checkin_due: {
    type: 'checkin_due',
    defaultTitle: 'Check-in due',
    defaultMessage: 'Your check-in is due today.',
  },
  habit_missing: {
    type: 'habit_missing',
    defaultTitle: 'Habit check-in',
    defaultMessage: "Don't forget to log your habits for today.",
  },
  prep_pose_check_due: {
    type: 'prep_pose_check_due',
    defaultTitle: 'Pose check due',
    defaultMessage: "Your weekly pose check is due. Submit your photos when you're ready.",
  },
  billing_due: {
    type: 'billing_due',
    defaultTitle: 'Payment due',
    defaultMessage: "Your payment is due or overdue. Please update your payment method to continue your coaching.",
  },
  // Coach-facing (inserted by DB triggers)
  checkin_submitted: {
    type: 'checkin_submitted',
    defaultTitle: 'Check-in submitted',
    defaultMessage: 'A client submitted a check-in.',
  },
  pose_check_submitted: {
    type: 'pose_check_submitted',
    defaultTitle: 'Pose check submitted',
    defaultMessage: 'A client submitted a pose check.',
  },
  client_flag_created: {
    type: 'client_flag_created',
    defaultTitle: 'Client flag created',
    defaultMessage: 'A client has a new flag.',
  },
  billing_failed: {
    type: 'billing_failed',
    defaultTitle: 'Billing failed',
    defaultMessage: "A client's payment is overdue.",
  },
  // Supplement adherence
  supplement_morning_reminder: {
    type: 'supplement_morning_reminder',
    defaultTitle: 'Morning supplements',
    defaultMessage: "Don't forget to take your morning supplements and log them in the app.",
  },
  supplement_evening_reminder: {
    type: 'supplement_evening_reminder',
    defaultTitle: 'Evening supplements',
    defaultMessage: "Time to take your evening supplements. Log them when you're done.",
  },
  supplement_missed_reminder: {
    type: 'supplement_missed_reminder',
    defaultTitle: 'Supplements not logged',
    defaultMessage: "You had supplements due today that haven't been logged yet. Tap to log them.",
  },
};

/**
 * Get default title and message for a trigger type.
 * @param {string} triggerType - One of REMINDER_TRIGGER_TYPES
 * @returns {{ title: string, message: string }}
 */
export function getReminderCopy(triggerType) {
  const config = REMINDER_TRIGGERS[triggerType];
  if (!config) {
    return { title: 'Reminder', message: 'You have an action due.' };
  }
  return { title: config.defaultTitle, message: config.defaultMessage };
}
