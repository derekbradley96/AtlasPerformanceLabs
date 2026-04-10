/**
 * Personal marketplace entry: canonical sources, hero copy, category hints, session persistence.
 * URL: Personal entry often goes `/personal/coach-tier-selection?source=…` then `/discover?from=personal&source=…&tier=…` (legacy `reason=` still normalized).
 */

import { track, ANALYTICS_EVENTS } from '@/services/analyticsService';

export const PERSONAL_MARKETPLACE_SOURCE = {
  FROM_PLATEAU: 'from_plateau',
  FROM_PREP: 'from_prep',
  FROM_ACCOUNTABILITY: 'from_accountability',
  FROM_ADVANCED_REFINEMENT: 'from_advanced_refinement',
  FROM_GENERAL_DISCOVERY: 'from_general_discovery',
  FROM_LOW_READINESS: 'from_low_readiness',
  FROM_GOAL_URGENCY: 'from_goal_urgency',
};

const ALL_SOURCES = new Set(Object.values(PERSONAL_MARKETPLACE_SOURCE));

/** Map legacy bridge `reason` / short keys → canonical `from_*` */
const REASON_TO_SOURCE = {
  plateau: PERSONAL_MARKETPLACE_SOURCE.FROM_PLATEAU,
  prep: PERSONAL_MARKETPLACE_SOURCE.FROM_PREP,
  accountability: PERSONAL_MARKETPLACE_SOURCE.FROM_ACCOUNTABILITY,
  consistency: PERSONAL_MARKETPLACE_SOURCE.FROM_ACCOUNTABILITY,
  /** Coach bridge: repeated week vs target gap */
  inconsistency: PERSONAL_MARKETPLACE_SOURCE.FROM_ACCOUNTABILITY,
  /** @deprecated legacy query keys */
  today_inactive: PERSONAL_MARKETPLACE_SOURCE.FROM_ACCOUNTABILITY,
  advanced: PERSONAL_MARKETPLACE_SOURCE.FROM_ADVANCED_REFINEMENT,
  nutrition_advanced: PERSONAL_MARKETPLACE_SOURCE.FROM_ADVANCED_REFINEMENT,
  recovery: PERSONAL_MARKETPLACE_SOURCE.FROM_LOW_READINESS,
  goal: PERSONAL_MARKETPLACE_SOURCE.FROM_GOAL_URGENCY,
  nutrition_goal: PERSONAL_MARKETPLACE_SOURCE.FROM_GOAL_URGENCY,
  nutrition: PERSONAL_MARKETPLACE_SOURCE.FROM_GENERAL_DISCOVERY,
  nutrition_prep: PERSONAL_MARKETPLACE_SOURCE.FROM_PREP,
  hub: PERSONAL_MARKETPLACE_SOURCE.FROM_GENERAL_DISCOVERY,
  personal: PERSONAL_MARKETPLACE_SOURCE.FROM_GENERAL_DISCOVERY,
};

const SESSION_KEY = 'atlas_marketplace_entry_source';

export function normalizePersonalMarketplaceSource(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (!s) return PERSONAL_MARKETPLACE_SOURCE.FROM_GENERAL_DISCOVERY;
  if (ALL_SOURCES.has(s)) return s;
  return REASON_TO_SOURCE[s] || PERSONAL_MARKETPLACE_SOURCE.FROM_GENERAL_DISCOVERY;
}

/** Merge query `source` / `reason` with optional React Router location state. */
export function resolvePersonalMarketplaceEntrySource(searchParams, locationState) {
  const fromQuery =
    searchParams?.get?.('source') || searchParams?.get?.('reason') || '';
  const fromState = locationState?.source || locationState?.trigger || locationState?.entrySource || '';
  const combined = fromQuery || fromState;
  return normalizePersonalMarketplaceSource(combined);
}

const DEFAULT_DISCOVERY_HEADLINE = 'Find the right coach for your goal';

const DEFAULT_DISCOVERY_BODY =
  "Whether you're trying to get lean, build size, or prep for stage, the right coach changes everything.";

/**
 * Optional contextual strip above the main marketplace headline (plateau, prep, accountability, advanced).
 * @returns {string|null}
 */
export function getPersonalMarketplaceContextBanner(source) {
  const S = PERSONAL_MARKETPLACE_SOURCE;
  const map = {
    [S.FROM_PLATEAU]:
      'You’ve been putting in the work — when progress slows, the right coach helps refine the plan.',
    [S.FROM_PREP]:
      'Prep and stage work reward precision. Here you can find coaches who live in that lane.',
    [S.FROM_ACCOUNTABILITY]:
      'Consistency is the hardest part. Coaching adds a real human loop when solo structure isn’t enough.',
    [S.FROM_ADVANCED_REFINEMENT]:
      'You’re past the basics — a coach can tighten execution where templates stop being enough.',
  };
  return map[source] || null;
}

/**
 * Hero body copy under the fixed headline; varies slightly by entry context.
 * @returns {string}
 */
export function getPersonalMarketplaceDiscoveryBody(source) {
  const S = PERSONAL_MARKETPLACE_SOURCE;
  const map = {
    [S.FROM_PLATEAU]:
      'Plateaus are often a signal to adjust training, nutrition, or recovery — not to work blindly harder. A coach helps you spot what to change.',
    [S.FROM_PREP]:
      'Lean, size, and stage timelines all need different judgement. Browse coaches who align with how serious this phase is for you.',
    [S.FROM_ACCOUNTABILITY]:
      'Whether you’re restarting often or life keeps interrupting, accountability from a coach can be the difference between drifting and staying on track.',
    [S.FROM_ADVANCED_REFINEMENT]:
      'You already train with intent. The next step is sharper feedback — load management, weak points, and decisions under fatigue.',
    [S.FROM_LOW_READINESS]:
      'If energy and readiness keep swinging, an experienced coach can help interpret signals and adjust without guessing.',
    [S.FROM_GOAL_URGENCY]:
      'When the timeline matters, coaching compresses guesswork — so you move with clearer priorities week to week.',
  };
  return map[source] || DEFAULT_DISCOVERY_BODY;
}

export function getPersonalMarketplaceDiscoveryHeadline() {
  return DEFAULT_DISCOVERY_HEADLINE;
}

export function persistMarketplaceEntrySource(source) {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_KEY, source);
    }
  } catch {
    /* ignore */
  }
}

export function readMarketplaceEntrySource() {
  try {
    if (typeof sessionStorage === 'undefined') return PERSONAL_MARKETPLACE_SOURCE.FROM_GENERAL_DISCOVERY;
    return normalizePersonalMarketplaceSource(sessionStorage.getItem(SESSION_KEY));
  } catch {
    return PERSONAL_MARKETPLACE_SOURCE.FROM_GENERAL_DISCOVERY;
  }
}

/** @returns {{ eyebrow: string, headline: string, body: string, primaryCta: string, secondaryCta: string }} */
export function getPersonalMarketplaceHero(source) {
  const S = PERSONAL_MARKETPLACE_SOURCE;
  const map = {
    [S.FROM_PLATEAU]: {
      eyebrow: 'Next level of support',
      headline: 'You’ve already been consistent, now refine the details',
      body: 'A coach can help break a stall when structure alone stops being enough.',
      primaryCta: 'Find the right coach',
      secondaryCta: 'Enter invite code',
    },
    [S.FROM_PREP]: {
      eyebrow: 'Prep precision',
      headline: 'Prep usually needs precision',
      body: 'Browse coaches who can help with hands-on contest or prep guidance.',
      primaryCta: 'Find prep coaches',
      secondaryCta: 'Enter invite code',
    },
    [S.FROM_ACCOUNTABILITY]: {
      eyebrow: 'Consistency',
      headline: 'Support helps when consistency slips',
      body: 'If you keep restarting, a coach can provide the accountability Atlas won’t pretend to replace.',
      primaryCta: 'Find accountability support',
      secondaryCta: 'Keep training solo',
    },
    [S.FROM_ADVANCED_REFINEMENT]: {
      eyebrow: 'Refinement',
      headline: 'You’ve outgrown guided solo mode',
      body: 'You’re doing the work. A coach can now refine what Enhanced should only suggest.',
      primaryCta: 'Browse coaches',
      secondaryCta: 'Enter invite code',
    },
    [S.FROM_LOW_READINESS]: {
      eyebrow: 'Recovery',
      headline: 'Recovery patterns may need a second set of eyes',
      body: 'Repeated low-readiness patterns are often where hands-on coaching makes the biggest difference.',
      primaryCta: 'Find the right coach',
      secondaryCta: 'Keep training solo',
    },
    [S.FROM_GOAL_URGENCY]: {
      eyebrow: 'Goal support',
      headline: 'This goal may need more than solo structure',
      body: 'If the timeline matters, a coach can help move faster and more safely.',
      primaryCta: 'Find the right coach',
      secondaryCta: 'Enter invite code',
    },
    [S.FROM_GENERAL_DISCOVERY]: {
      eyebrow: 'Coaching on Atlas',
      headline: 'Find a coach that fits your goal',
      body: 'Browse coaches for transformation, prep, accountability, or performance support.',
      primaryCta: 'Browse coaches',
      secondaryCta: 'Enter invite code',
    },
  };
  return map[source] || map[S.FROM_GENERAL_DISCOVERY];
}

/**
 * Suggested categories: label + optional filter hints for discovery chips.
 * @returns {Array<{ id: string, label: string, coachType?: string, acceptsCompetition?: boolean, acceptsTransformation?: boolean }>}
 */
export function getPersonalMarketplaceCategoryHints(source) {
  const S = PERSONAL_MARKETPLACE_SOURCE;
  switch (source) {
    case S.FROM_PREP:
      return [
        { id: 'prep', label: 'Prep coaches', acceptsCompetition: true },
        { id: 'comp', label: 'Competition coaches', acceptsCompetition: true },
        { id: 'physique', label: 'Physique / stage-focused', coachType: 'competition' },
      ];
    case S.FROM_PLATEAU:
      return [
        { id: 'trans', label: 'Transformation coaches', acceptsTransformation: true },
        { id: 'bodycomp', label: 'Body composition focus', coachType: 'transformation' },
        { id: 'strength', label: 'Strength / progression', coachType: 'integrated' },
      ];
    case S.FROM_ACCOUNTABILITY:
      return [
        { id: 'habit', label: 'Habit & consistency coaches', coachType: 'transformation' },
        { id: 'lifestyle', label: 'Lifestyle transformation', acceptsTransformation: true },
      ];
    case S.FROM_GOAL_URGENCY:
      return [
        { id: 'fast', label: 'High-accountability coaches', acceptsTransformation: true },
        { id: 'prepopt', label: 'Prep-capable coaches', acceptsCompetition: true },
        { id: 'transform', label: 'Transformation focus', coachType: 'transformation' },
      ];
    case S.FROM_ADVANCED_REFINEMENT:
    case S.FROM_LOW_READINESS:
      return [
        { id: 'integrated', label: 'Integrated coaching', coachType: 'integrated' },
        { id: 'trans', label: 'Transformation', coachType: 'transformation' },
        { id: 'performance', label: 'Performance-focused', coachType: 'integrated' },
      ];
    default:
      return [
        { id: 'trans', label: 'Transformation', coachType: 'transformation' },
        { id: 'comp', label: 'Competition', coachType: 'competition' },
        { id: 'acc', label: 'Accountability', acceptsTransformation: true },
        { id: 'perf', label: 'Performance', coachType: 'integrated' },
      ];
  }
}

/** Optional “fit” line for coach cards based on entry context */
export function getMarketplaceSourceFitLine(entrySource, coach) {
  const focus = String(coach?.coach_focus || '').toLowerCase();
  const S = PERSONAL_MARKETPLACE_SOURCE;
  switch (entrySource) {
    case S.FROM_PLATEAU:
      if (coach?.accepts_transformation || focus === 'transformation' || focus === 'integrated') return 'Good for breaking plateaus';
      return null;
    case S.FROM_PREP:
      if (coach?.accepts_competition || focus === 'competition') return 'Good for prep';
      return null;
    case S.FROM_ACCOUNTABILITY:
      if (coach?.accepts_transformation || focus === 'integrated') return 'Good for accountability';
      return null;
    case S.FROM_LOW_READINESS:
      if (focus === 'integrated' || coach?.accepts_transformation) return 'Good for recovery judgement';
      return null;
    case S.FROM_ADVANCED_REFINEMENT:
      if (focus === 'integrated' || focus === 'competition') return 'Good for deeper refinement';
      return null;
    case S.FROM_GOAL_URGENCY:
      if (coach?.accepts_transformation || focus === 'integrated' || focus === 'competition')
        return 'Good for tight timelines';
      return null;
    default:
      return null;
  }
}

const SOURCE_TO_SPECIFIC_EVENT = {
  [PERSONAL_MARKETPLACE_SOURCE.FROM_PLATEAU]: ANALYTICS_EVENTS.MARKETPLACE_OPENED_FROM_PLATEAU,
  [PERSONAL_MARKETPLACE_SOURCE.FROM_PREP]: ANALYTICS_EVENTS.MARKETPLACE_OPENED_FROM_PREP,
  [PERSONAL_MARKETPLACE_SOURCE.FROM_ACCOUNTABILITY]: ANALYTICS_EVENTS.MARKETPLACE_OPENED_FROM_ACCOUNTABILITY,
  [PERSONAL_MARKETPLACE_SOURCE.FROM_ADVANCED_REFINEMENT]: ANALYTICS_EVENTS.MARKETPLACE_OPENED_FROM_ADVANCED_REFINEMENT,
  [PERSONAL_MARKETPLACE_SOURCE.FROM_GENERAL_DISCOVERY]: ANALYTICS_EVENTS.MARKETPLACE_OPENED_FROM_GENERAL_DISCOVERY,
  [PERSONAL_MARKETPLACE_SOURCE.FROM_LOW_READINESS]: ANALYTICS_EVENTS.MARKETPLACE_OPENED_FROM_LOW_READINESS,
  [PERSONAL_MARKETPLACE_SOURCE.FROM_GOAL_URGENCY]: ANALYTICS_EVENTS.MARKETPLACE_OPENED_FROM_GOAL_URGENCY,
};

/** Fire base + source-specific marketplace open events (once per landing). */
export function trackPersonalMarketplaceOpened(entrySource) {
  const normalized = normalizePersonalMarketplaceSource(entrySource);
  track(ANALYTICS_EVENTS.PERSONAL_OPENED_FIND_A_COACH, { entry_source: normalized }).catch(() => {});
  track(ANALYTICS_EVENTS.MARKETPLACE_OPENED_FROM_PERSONAL, { entry_source: normalized }).catch(() => {});
  const specific = SOURCE_TO_SPECIFIC_EVENT[normalized];
  if (specific) track(specific, { entry_source: normalized }).catch(() => {});
}

export function trackCoachConsultationRequestedFromPersonal(extra = {}) {
  track(ANALYTICS_EVENTS.COACH_CONSULTATION_REQUESTED_FROM_PERSONAL, {
    ...extra,
    entry_source: readMarketplaceEntrySource(),
  }).catch(() => {});
}

export function trackCoachProfileOpenedFromPersonal(extra = {}) {
  track(ANALYTICS_EVENTS.COACH_PROFILE_OPENED_FROM_PERSONAL, {
    ...extra,
    entry_source: readMarketplaceEntrySource(),
  }).catch(() => {});
}

export function trackInviteCodeEnteredFromPersonal(extra = {}) {
  track(ANALYTICS_EVENTS.INVITE_CODE_ENTERED_FROM_PERSONAL, extra).catch(() => {});
}
