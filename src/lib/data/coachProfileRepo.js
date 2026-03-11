/**
 * Coach profile: single source of truth for trainer onboarding and public profile.
 * Persisted in localStorage (mock); replace with API in production.
 *
 * CoachProfile { id, displayName, handle, timezone, workingHours, responseTargetHours,
 *   services[], policies, branding, onboardingComplete, createdAt, updatedAt }
 */

import { getTrainerProfile } from '@/lib/trainerFoundation';
import { VALID_COACH_FOCUS } from '@/lib/coachFocus';
import { DEFAULT_COACH_TYPE } from './coachProfileTypes';

const KEY = 'atlas_coach_profile';

function load() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(map) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(map));
  } catch {}
}

/** @param {string} userId - trainer/user id */
export function getCoachProfile(userId) {
  if (!userId) return null;
  const map = load();
  return map[userId] ?? null;
}

/** Find coach profile by public handle (for /i/:handle and /lead-intake/:handle). */
export function getCoachProfileByHandle(handle) {
  const normalized = (handle || '').trim().toLowerCase();
  if (!normalized) return null;
  const map = load();
  for (const userId of Object.keys(map)) {
    const p = map[userId];
    if ((p.handle || '').trim().toLowerCase() === normalized) return { ...p, userId };
  }
  return null;
}

/** @param {string} userId
 *  @param {Partial<import('./coachProfileTypes').CoachProfile>} payload
 */
export function setCoachProfile(userId, payload) {
  if (!userId) return null;
  const map = load();
  const now = new Date().toISOString();
  const current = map[userId] || {};
  const next = {
    id: current.id || `coach-${userId}`,
    displayName: payload.displayName !== undefined ? payload.displayName : current.displayName,
    handle: payload.handle !== undefined ? payload.handle : current.handle,
    timezone: payload.timezone !== undefined ? payload.timezone : current.timezone,
    workingHours: payload.workingHours !== undefined ? payload.workingHours : current.workingHours,
    responseTargetHours: payload.responseTargetHours !== undefined ? payload.responseTargetHours : current.responseTargetHours,
    services: payload.services !== undefined ? payload.services : (current.services || []),
    policies: payload.policies !== undefined ? payload.policies : (current.policies || {}),
    branding: payload.branding !== undefined ? payload.branding : (current.branding || {}),
    adminBudgetHoursPerWeek: payload.adminBudgetHoursPerWeek !== undefined ? payload.adminBudgetHoursPerWeek : current.adminBudgetHoursPerWeek,
    plan_tier: payload.plan_tier !== undefined ? payload.plan_tier : current.plan_tier,
    coach_type: payload.coach_type !== undefined ? payload.coach_type : current.coach_type,
    coach_focus: payload.coach_focus !== undefined ? payload.coach_focus : current.coach_focus,
    onboardingComplete: payload.onboardingComplete !== undefined ? payload.onboardingComplete : current.onboardingComplete,
    onboardingSkipped: payload.onboardingSkipped !== undefined ? payload.onboardingSkipped : current.onboardingSkipped,
    createdAt: current.createdAt || now,
    updatedAt: now,
  };
  map[userId] = next;
  save(map);
  return next;
}

const VALID_COACH_TYPES = ['prep', 'fitness', 'hybrid'];
const LEGACY_COACH_TYPES = ['general', 'both'];

/** @param {string} userId - true if coach_focus or coach_type was set (gating uses coach_focus) */
export function hasCoachTypeSet(userId) {
  const profile = getCoachProfile(userId);
  const focus = (profile?.coach_focus ?? '').toString().trim().toLowerCase();
  if (focus && VALID_COACH_FOCUS.includes(focus)) return true;
  const t = profile?.coach_type;
  return VALID_COACH_TYPES.includes(t) || LEGACY_COACH_TYPES.includes(t);
}

/** Normalize legacy DB values to canonical (prep | fitness | hybrid). */
export function normalizeCoachType(t) {
  if (VALID_COACH_TYPES.includes(t)) return t;
  if (t === 'general') return 'fitness';
  if (t === 'both') return 'hybrid';
  return null;
}

/** coach_focus -> coach_type for legacy consumers */
function coachFocusToCoachType(focus) {
  if (focus === 'transformation') return 'fitness';
  if (focus === 'competition') return 'prep';
  if (focus === 'integrated') return 'hybrid';
  return null;
}

/** @param {string} userId - coach_type from profile (prefer coach_focus) or default */
export function getCoachType(userId) {
  const profile = getCoachProfile(userId);
  const focus = (profile?.coach_focus ?? '').toString().trim().toLowerCase();
  if (focus && VALID_COACH_FOCUS.includes(focus)) {
    return coachFocusToCoachType(focus) || DEFAULT_COACH_TYPE;
  }
  const t = profile?.coach_type;
  const normalized = normalizeCoachType(t);
  if (normalized) return normalized;
  return DEFAULT_COACH_TYPE;
}

/** @param {string} userId - true if onboarding done or skipped (allowed to use app) */
export function isCoachOnboardingComplete(userId) {
  const profile = getCoachProfile(userId);
  if (profile?.onboardingComplete) return true;
  if (profile?.onboardingSkipped) return true;
  const legacy = getTrainerProfile(userId);
  return !!legacy?.onboardingComplete;
}

/** @param {string} userId - true if coach skipped onboarding and has not completed it */
export function isCoachOnboardingSkipped(userId) {
  const profile = getCoachProfile(userId);
  return !!profile?.onboardingSkipped && !profile?.onboardingComplete;
}

/** Call once after login: if legacy profile has onboarding complete, create CoachProfile so we don't re-prompt. */
export function migrateLegacyOnboarding(userId) {
  if (!userId || getCoachProfile(userId)) return;
  const legacy = getTrainerProfile(userId);
  if (legacy?.onboardingComplete) {
    setCoachProfile(userId, {
      displayName: legacy.displayName,
      handle: legacy.username,
      timezone: legacy.timezone,
      workingHours: legacy.workingHours,
      responseTargetHours: legacy.responseTime ? 24 : undefined,
      onboardingComplete: true,
    });
  }
}
