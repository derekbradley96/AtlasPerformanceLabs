/**
 * Atlas page layout – shared spacing, card style, section labels.
 * Use on all role-based screens for premium consistency (Coach, Client, Personal).
 * No new UI libraries; aligns with shell + tokens.
 */
import { colors, spacing, shell } from '@/ui/tokens';

/**
 * Bottom padding for the AppShell scroll outlet (tab vs pushed route).
 * Tab routes: main already reserves nav + safe area — add flat inset only.
 * Pushed routes: include safe area so content clears the home indicator.
 */
export function getAppShellOutletScrollPaddingBottom(showTabBar) {
  const px = shell.scrollContentInsetBottom;
  if (showTabBar) return px;
  return `calc(${px}px + env(safe-area-inset-bottom, 0px))`;
}

/** Standalone full-screen pages (TopBar-only, marketing, etc.): bottom breathing room + safe area. */
export function getStandaloneScrollablePagePaddingBottom() {
  return `calc(${shell.scrollContentInsetBottom}px + env(safe-area-inset-bottom, 0px))`;
}

/** Horizontal padding + top spacing for page content (same as shell). */
export const pageContainer = {
  paddingLeft: shell.pagePaddingH,
  paddingRight: shell.pagePaddingH,
  paddingTop: shell.topSpacing,
};

/** Standard card: dark background, subtle border, radius, glow. */
export const standardCard = {
  background: colors.card,
  border: `1px solid ${shell.cardBorder}`,
  borderRadius: shell.cardRadius,
  boxShadow: shell.cardShadow,
};

/** Section label above blocks (e.g. "NEEDS ATTENTION", "SHORTCUTS"). */
export const sectionLabel = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: colors.muted,
  marginBottom: shell.sectionLabelMarginBottom,
};

/** Vertical gap between sections. */
export const sectionGap = shell.sectionSpacing;

/** Shared responsive layout primitives for mobile app vs desktop web presentation. */
export const layout = {
  widths: {
    compact: 680,
    content: 980,
    dashboard: 1240,
    marketing: 1280,
  },
  pagePadding: {
    mobile: spacing[16],
    tablet: spacing[20],
    desktop: spacing[24],
  },
};

export function responsivePageStyle({ desktop = false, maxWidth = layout.widths.dashboard, top = spacing[12], bottom = spacing[24] } = {}) {
  return {
    width: '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
    maxWidth,
    paddingLeft: desktop ? layout.pagePadding.desktop : layout.pagePadding.mobile,
    paddingRight: desktop ? layout.pagePadding.desktop : layout.pagePadding.mobile,
    paddingTop: top,
    paddingBottom: bottom,
  };
}

export function responsiveGridColumns({ desktop = false, min = 280 } = {}) {
  return {
    display: 'grid',
    gridTemplateColumns: desktop ? `repeat(auto-fit, minmax(${min}px, 1fr))` : '1fr',
    gap: spacing[12],
  };
}

/** Consistent vertical cadence + gutters for desktop polish passes. */
export function desktopRhythm(desktop = false) {
  return {
    top: desktop ? spacing[16] : spacing[12],
    section: desktop ? spacing[20] : spacing[12],
    gutter: desktop ? spacing[20] : spacing[12],
    cardPadding: desktop ? spacing[20] : spacing[16],
  };
}

/** Shared chip paddings so pills look consistent across pages. */
export function chipPadding({ desktop = false, density = 'default' } = {}) {
  if (density === 'compact') {
    return {
      paddingLeft: desktop ? spacing[12] : spacing[10],
      paddingRight: desktop ? spacing[12] : spacing[10],
      paddingTop: desktop ? spacing[5] : spacing[6],
      paddingBottom: desktop ? spacing[5] : spacing[6],
    };
  }
  return {
    paddingLeft: desktop ? spacing[16] : spacing[14],
    paddingRight: desktop ? spacing[16] : spacing[14],
    paddingTop: desktop ? spacing[8] : spacing[10],
    paddingBottom: desktop ? spacing[8] : spacing[10],
  };
}

/** Card-internal title/body/action spacing rhythm. */
export function cardContentRhythm(desktop = false) {
  return {
    titleBottom: desktop ? spacing[8] : spacing[6],
    bodyBottom: desktop ? spacing[12] : spacing[10],
    actionsTop: desktop ? spacing[12] : spacing[10],
    sectionTitleBottom: desktop ? spacing[10] : spacing[8],
  };
}
