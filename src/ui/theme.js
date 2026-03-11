/**
 * Design system theme – single source for surfaces, typography, elevations, blur.
 * Re-exports and extends tokens for premium SaaS consistency.
 */
import { colors, spacing, radii, shadows } from './tokens';

export { colors, spacing, radii, shadows } from './tokens';

export const theme = {
  colors: {
    ...colors,
    surface1: colors.surface1,
    surface2: colors.surface2,
    border: colors.border,
    text: colors.text,
    muted: colors.muted,
    accent: colors.accent,
    primary: colors.primary,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
  },
  typography: {
    h1: { fontSize: 24, fontWeight: 700, lineHeight: 1.25 },
    h2: { fontSize: 20, fontWeight: 600, lineHeight: 1.3 },
    h3: { fontSize: 17, fontWeight: 600, lineHeight: 1.35 },
    body: { fontSize: 15, fontWeight: 400, lineHeight: 1.5 },
    bodySmall: { fontSize: 14, fontWeight: 400, lineHeight: 1.45 },
    muted: { fontSize: 13, fontWeight: 400, lineHeight: 1.4 },
    caption: { fontSize: 12, fontWeight: 400, lineHeight: 1.35 },
    label: { fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' },
    mono: { fontFamily: 'ui-monospace, monospace', fontSize: 13 },
  },
  elevations: {
    card: '0 1px 3px rgba(0,0,0,0.12)',
    dropdown: '0 4px 12px rgba(0,0,0,0.2)',
    modal: '0 8px 32px rgba(0,0,0,0.35)',
  },
  blur: {
    sheet: 'blur(12px)',
    nav: 'blur(12px)',
  },
  gradients: {
    bgSubtle: 'linear-gradient(180deg, rgba(17,24,39,0.4) 0%, transparent 100%)',
  },
  spacing: spacing,
  radii: radii,
  shadows: shadows,
};

export default theme;
