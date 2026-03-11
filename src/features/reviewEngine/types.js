/**
 * Shared Review Engine types for check-in and posing review.
 * Data-driven so the same UI can render both contexts.
 */

/** @typedef {'checkin' | 'posing' | 'photo'} ReviewContext */

/**
 * One side of a compare (left = this week / current, right = last week / reference).
 * @typedef {{
 *   title: string
 *   metrics?: Array<{ label: string, value: string | number | null, trend?: 'up'|'down'|'neutral', delta?: number, deltaWarning?: string }>
 *   notes?: string
 *   imageUri?: string
 * }} ReviewPanel
 */

/**
 * @typedef {{
 *   id: string
 *   clientId: string
 *   type: ReviewContext
 *   createdAt: string
 *   status: 'needs_review' | 'reviewed'
 *   title: string
 *   subtitle?: string
 *   left: ReviewPanel
 *   right?: ReviewPanel
 *   quickReplyContext?: { goalPhase?: 'bulk' | 'cut' | 'maintenance' }
 *   phaseContext?: { label: string; expectation: string }
 *   riskReasons?: string[]
 *   suggestedAction?: string
 *   diffRows?: Array<{ label: string, curr: string | number | null, prev: string | number | null, format: (v: any) => string, delta?: number | null }>
 *   warnings?: string[]
 * }} ReviewItem
 */

export const REVIEW_CONTEXT = /** @type {const} */ ({ CHECKIN: 'checkin', POSING: 'posing', PHOTO: 'photo' });
