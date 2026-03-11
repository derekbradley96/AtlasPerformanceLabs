/**
 * Atlas page layout – shared spacing, card style, section labels.
 * Use on all role-based screens for premium consistency (Coach, Client, Personal).
 * No new UI libraries; aligns with shell + tokens.
 */
import { colors, spacing, shell } from '@/ui/tokens';

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
