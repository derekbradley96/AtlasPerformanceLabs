/**
 * @typedef {Object} CoachProfileService
 * @property {string} id
 * @property {string} name
 * @property {string} [description]
 * @property {boolean} [compPrepAddOn]
 * @property {string} [checkInFrequency] - 'weekly' | 'biweekly'
 * @property {string[]} [tags]
 */

/**
 * @typedef {Object} CoachProfilePolicies
 * @property {number} [checkInDay] - 0-6 (Sun-Sat)
 * @property {string} [responseWindow] - e.g. 'Mon-Fri'
 * @property {string} [paymentTerms]
 * @property {string} [pausePolicy]
 * @property {string} [peakWeekRules]
 * @property {string} [cancellationRefund]
 */

/**
 * @typedef {Object} CoachProfileBranding
 * @property {string} [profilePhotoUrl]
 * @property {string} [bannerImageUrl]
 * @property {string[]} [portfolioUrls]
 * @property {string[]} [uspBullets] - max 3
 * @property {string[]} [specialties]
 * @property {string} [instagram]
 * @property {string} [website]
 */

/**
 * @typedef {Object} CoachProfile
 * @property {string} id
 * @property {string} [displayName]
 * @property {string} [handle]
 * @property {string} [timezone]
 * @property {Object} [workingHours] - { days: number[], startTime, endTime } or similar
 * @property {number} [responseTargetHours]
 * @property {CoachProfileService[]} services
 * @property {CoachProfilePolicies} policies
 * @property {CoachProfileBranding} branding
 * @property {boolean} onboardingComplete
 * @property {string} [plan_tier] - 'basic' | 'pro' | 'elite' (billing plan)
 * @property {string} [coach_type] - 'prep' | 'fitness' | 'hybrid' (coaching focus; from profiles)
 * @property {string} [createdAt]
 * @property {string} [updatedAt]
 */

/** Valid coach_type values (Supabase profiles.coach_type). */
export const COACH_TYPES = ['prep', 'fitness', 'hybrid'];
/** Default when not set (DB default 'fitness'). */
export const DEFAULT_COACH_TYPE = 'fitness';
