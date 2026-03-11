/**
 * Atlas Performance Labs – central theme and palette.
 *
 * - Use ATLAS_COLORS for inline styles (e.g. charts, third-party libs).
 * - Prefer Tailwind atlas-* classes (bg-atlas-accent, border-atlas-border, etc.)
 *   or themeClasses so future screens stay on-brand.
 * - Palette is mirrored in tailwind.config.js (theme.extend.colors.atlas) and
 *   in index.css (--primary, --background, etc. for .dark).
 */

/** Atlas palette – hex values for non-Tailwind use (e.g. canvas, third-party). */
export const ATLAS_COLORS = {
  bg: '#0B1220',
  surface: '#111827',
  primary: '#3B82F6',
  accent: '#3B82F6',
  text: '#E5E7EB',
  muted: '#9CA3AF',
  success: '#16A34A',
  warning: '#F59E0B',
  error: '#DC2626',
  backgroundLight: '#E5E7EB',
  backgroundDark: '#0B1220',
  surfaceAlt: '#0B1220',
  border: '#334155',
} as const;

/** Tailwind class combinations for common UI patterns. Use for consistency. */
export const themeClasses = {
  /** Full-page dark background. */
  pageBg: 'bg-atlas-bg',
  /** Card: dark surface with border. */
  card: 'bg-atlas-surface/50 border border-atlas-border/50',
  /** Card with rounded corners (combine with card). */
  cardRounded: 'rounded-2xl',
  /** Primary CTA button. */
  buttonPrimary: 'bg-atlas-primary hover:bg-atlas-primary/90 text-white',
  /** Secondary/outline button. */
  buttonSecondary: 'border-atlas-border text-atlas-text hover:bg-atlas-surface/50',
  /** Demo mode banner. */
  demoBanner: 'bg-atlas-border/60 text-atlas-muted border-b border-atlas-border',
  /** Input field on dark background. */
  input: 'bg-atlas-bg border-atlas-border focus:ring-atlas-primary',
  /** Sidebar / nav surface. */
  sidebar: 'bg-atlas-bg border-atlas-border',
  /** Logo/icon accent. */
  logoGradient: 'bg-atlas-primary',
} as const;

export default { ATLAS_COLORS, themeClasses };
