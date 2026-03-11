/**
 * Tunable workload estimator defaults. Minutes per item type.
 */
export const MIN_PER_CHECKIN = 6;
export const MIN_PER_POSING = 4;
export const MIN_PEAK_WEEK = 2;
export const MIN_PAYMENT = 2;
export const MIN_MESSAGE_THREAD = 2;
export const MIN_LEAD = 3;

export const DEFAULT_DAILY_ADMIN_LIMIT_MINUTES = 60;

/** Status bands: total <= limit => IN_CONTROL; limit+1..limit+30 => BUSY; > limit+30 => OVERLOADED */
export const BUSY_BUFFER_MINUTES = 30;
