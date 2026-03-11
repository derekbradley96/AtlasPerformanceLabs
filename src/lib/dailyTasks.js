/**
 * Unified definition of the key daily tasks an athlete should complete today.
 * Pure helper (no React or Supabase) so it can be reused by dashboards, widgets, etc.
 *
 * Tasks covered:
 * - workout
 * - steps
 * - supplements
 * - checkin
 */

/** Canonical task keys in display order. */
export const DAILY_TASK_KEYS = ['workout', 'steps', 'supplements', 'checkin'];

/**
 * Metadata per daily task.
 *
 * - key: stable identifier
 * - label: short display name
 * - description: helper copy for tooltips / empty states
 * - route: suggested route when the task is tapped
 */
export const DAILY_TASKS = {
  workout: {
    key: 'workout',
    label: 'Workout',
    description: 'Complete today’s programmed training session.',
    route: '/today',
  },
  steps: {
    key: 'steps',
    label: 'Steps',
    description: 'Hit your daily step target.',
    route: '/progress',
  },
  supplements: {
    key: 'supplements',
    label: 'Supplements',
    description: 'Take and log your supplements for today.',
    route: '/client/supplements',
  },
  checkin: {
    key: 'checkin',
    label: 'Check-in',
    description: 'Submit your weekly check-in to your coach.',
    route: '/check-in',
  },
};

/**
 * Return the default ordered list of daily task configs.
 * Callers can decorate these with completion state and progress.
 */
export function getDefaultDailyTasks() {
  return DAILY_TASK_KEYS.map((key) => DAILY_TASKS[key]);
}

