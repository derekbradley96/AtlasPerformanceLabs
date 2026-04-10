/**
 * Retro Corporate Neon UI tokens. Single source of truth.
 * Use for inline styles and consistency. Aligns with CSS vars in index.css where needed.
 */
export const spacing = {
  4: 4,
  6: 6,
  8: 8,
  10: 10,
  12: 12,
  14: 14,
  16: 16,
  18: 18,
  20: 20,
  24: 24,
  32: 32,
  40: 40,
};

export const radii = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  full: 9999,
  card: 16,
  button: 14,
  pill: 999,
};

export const colors = {
  // Backgrounds (Atlas palette)
  bg: '#0B1220',
  bgPrimary: '#0B1220',
  surface: '#111827',
  surface1: '#111827',
  surface2: '#1F2937',
  card: '#111827',
  // Brand & accent (Atlas blue – no teal/cyan)
  primary: '#3B82F6',
  accent: '#60A5FA',
  brand: '#3B82F6',
  accentGlow: '#3B82F6',
  // Text
  text: '#E5E7EB',
  textPrimary: '#E5E7EB',
  textSecondary: '#9CA3AF',
  textMuted: '#9CA3AF',
  muted: '#9CA3AF',
  // Borders
  border: 'rgba(255,255,255,0.08)',
  borderActive: 'rgba(59,130,246,0.25)',
  // Overlay & states
  overlay: 'rgba(0,0,0,0.5)',
  primarySubtle: 'rgba(59,130,246,0.2)',
  successSubtle: 'rgba(34,197,94,0.2)',
  warningSubtle: 'rgba(234,179,8,0.2)',
  // Semantic
  success: '#22C55E',
  warning: '#EAB308',
  danger: '#EF4444',
  destructive: '#EF4444',
  attention: '#EF4444',
};

export const shadows = {
  glow: '0 0 24px rgba(59,130,246,0.15)',
  brandGlow: '0 4px 20px rgba(59,130,246,0.25)',
};

/**
 * Elevation / emphasis — use instead of one-off boxShadow strings.
 * Maps to Atlas semantic intent (card chrome, hover, premium, match quality, urgency).
 */
export const atlasElevation = {
  cardStandard: '0 4px 24px rgba(0,0,0,0.22)',
  cardHover: '0 8px 32px rgba(0,0,0,0.28)',
  premiumHighlight: '0 12px 48px rgba(0,0,0,0.38), 0 0 30px rgba(37,99,235,0.18)',
  bestMatch: '0 0 28px rgba(59,130,246,0.35)',
  urgentAttention: '0 0 20px rgba(239,68,68,0.35)',
};

/** Typography roles (px / weights) — pair with colors.text, colors.muted, etc. */
export const atlasTypography = {
  pageTitle: { fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 },
  sectionHeading: { fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' },
  cardTitle: { fontSize: 18, fontWeight: 700, lineHeight: 1.25 },
  body: { fontSize: 14, fontWeight: 400, lineHeight: 1.45 },
  bodyStrong: { fontSize: 14, fontWeight: 600, lineHeight: 1.45 },
  support: { fontSize: 12, fontWeight: 400, lineHeight: 1.4 },
  meta: { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' },
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' },
};

/**
 * Semantic color roles for UI (alias existing palette — single import for components).
 */
export const atlasColors = {
  primary: colors.primary,
  accent: colors.accent,
  surface: colors.surface1,
  surfaceRaised: colors.surface2,
  border: colors.border,
  borderActive: colors.borderActive,
  text: colors.text,
  muted: colors.muted,
  positive: colors.success,
  positiveSubtle: colors.successSubtle,
  warning: colors.warning,
  warningSubtle: colors.warningSubtle,
  danger: colors.danger,
  dangerSubtle: 'rgba(239,68,68,0.2)',
  onPrimary: '#ffffff',
};

export const touchTargetMin = 44;
export const rowHeight = 68;

/** Atlas app shell – same across Coach, Client, Personal */
export const shell = {
  headerHeight: 54,
  pagePaddingH: 16,
  sectionSpacing: 16,
  topSpacing: 12,
  /** No visible header divider; transparent so no bright line under page headers. */
  headerBorder: 'transparent',
  cardRadius: 16,
  cardBorder: 'rgba(255,255,255,0.08)',
  cardShadow: '0 0 24px rgba(59,130,246,0.12)',
  iconContainerSize: 40,
  iconContainerRadius: 12,
  /** Section header: label above content blocks (Quick access, Recent activity, etc.) */
  sectionLabelFontSize: 13,
  sectionLabelLetterSpacing: '0.04em',
  sectionLabelMarginBottom: 12,
  /** List rows: client/conversation/program/review rows */
  listRowAvatarSize: 44,
  listRowPaddingH: 16,
  listRowPaddingV: 12,
  listRowGap: 12,
  /**
   * Extra bottom inset inside the shell scroll column so the last card/CTA clears comfortably
   * above the tab bar (tab routes) or home indicator (pushed routes). Use with getAppShellOutletScrollPaddingBottom().
   */
  scrollContentInsetBottom: 40,
};
