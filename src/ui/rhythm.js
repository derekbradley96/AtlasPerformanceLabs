/**
 * Vertical rhythm + card templates — use instead of ad-hoc margins across Atlas surfaces.
 * Aligns with shell tokens; web vs app wrappers choose density via the same numbers.
 */

/** Named scale: space-1 … space-10 (px). */
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
};

/** Between cards in the same section */
export const sectionGapTight = space[4]; // 16px; use 20 where noted below
export const sectionGapTightMax = space[5]; // 20px

/** Between major sections on a page */
export const sectionGapMajor = space[6]; // 24px
export const sectionGapMajorLg = space[8]; // 32px

/** Section heading → first card */
export const sectionHeadingBelow = space[3]; // 12px
export const sectionHeadingBelowMax = space[4]; // 16px

/** Page intro / top bar → first hero */
export const pageIntroToHero = space[6]; // 24px

/**
 * Card padding templates (px).
 * Use in style={{ padding: … }} or paddingTop/Bottom splits.
 */
export const cardRhythm = {
  hero: {
    padding: 24,
    eyebrowToTitle: 8,
    titleToDescription: 8,
    descriptionToCta: 16,
    bottomBreathing: 20,
  },
  standard: {
    padding: 20,
    titleToBody: 8,
    bodyStack: 12,
    ctaGap: 16,
  },
  compactList: {
    paddingX: 16,
    paddingY: 14,
  },
  emptyState: {
    padding: 24,
    iconToTitle: 12,
    titleToDescription: 8,
    descriptionToCta: 16,
  },
  status: {
    paddingMin: 18,
    paddingMax: 20,
    labelToValue: 8,
    valueToSupport: 8,
  },
  /** Settings / form-heavy cards */
  settings: {
    padding: 20,
    titleToBody: 10,
    bodyStack: 14,
    rowGap: 12,
    ctaGap: 16,
  },
  /** Coach primary action tiles (home queue, command center) */
  coachAction: {
    padding: 18,
    titleToBody: 8,
    bodyToMeta: 10,
    metaToCta: 14,
  },
  /** Side-by-side or A/B comparison blocks */
  comparison: {
    padding: 20,
    columnGap: 16,
    titleToBody: 8,
    bodyToCta: 16,
  },
};

/** Typography stack gaps (eyebrow → heading → body → chips → CTAs) */
export const typeStack = {
  eyebrowToHeading: space[2],
  headingToBody: space[2],
  bodyToChips: space[3],
  chipsToProof: space[3],
  proofToCta: space[4],
};

/** Between stacked cards in the same section */
export const cardToCardGap = space[3];

/** Dense lists of small cards */
export const cardToCardGapCompact = space[2];

/** Bottom breathing room target (aligns with shell.scrollContentInsetBottom) */
export const pageBottomBreathing = space[10];

/**
 * Title → body → tags → CTA → card/section/page spacing (px).
 */
export const contentStackRules = {
  titleToBody: cardRhythm.standard.titleToBody,
  bodyToTags: typeStack.bodyToChips,
  tagsToCta: typeStack.proofToCta,
  cardToCard: cardToCardGap,
  sectionToSection: sectionGapMajor,
  pageBottom: pageBottomBreathing,
};
