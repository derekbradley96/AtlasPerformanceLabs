/**
 * Retro Corporate Neon UI tokens. Single source of truth.
 * Use for inline styles and consistency. Aligns with CSS vars in index.css where needed.
 */
export const spacing = {
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
};

export const radii = {
  sm: 12,
  md: 16,
  lg: 20,
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
};
