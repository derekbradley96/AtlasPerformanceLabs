/**
 * Personal mode presentation: shared layout math for web (premium SaaS column) vs mobile (touch-first, full-bleed).
 * Product + role logic stay in feature modules; this file is presentation only.
 *
 * Canonical usage:
 * - Full page, no edge-to-edge header → `PersonalSurface` (or `PersonalCanvas` + `PersonalColumn`).
 * - `TopBar` must span full width → `PersonalCanvas` → `TopBar` → `PersonalColumn` → scroll body (often `paddingBottom: spacing[24]` only inside the column).
 * - Variants: `default` (680), `wide` (980, charts/builders), `narrow` (560, account/legal-style), `home` (Personal Home dashboard web).
 */
import { colors, shell, spacing } from '@/ui/tokens';
import { layout } from '@/ui/pageLayout';

/** Readable single column on desktop web (matches layout.widths.compact). */
export const PERSONAL_WEB_COLUMN_MAX = layout.widths.compact;

/** Wider column for charts / builder-heavy views. */
export const PERSONAL_WEB_WIDE_MAX = layout.widths.content;

/** Personal Home on desktop: full dashboard width (reduces “floating narrow column” feel). */
export const PERSONAL_HOME_WEB_MAX = 1360;

/**
 * @param {object} opts
 * @param {boolean} opts.isDesktopWeb
 * @param {boolean} [opts.isWideWeb] Web at tablet+ width (768+); widens column like desktop without requiring 1024px.
 * @param {boolean} [opts.native] Capacitor / native shell
 * @param {'default'|'wide'|'narrow'|'home'} [opts.variant]
 */
export function personalMainColumnStyle({ isDesktopWeb, isWideWeb = false, native = false, variant = 'default' }) {
  const wide = isDesktopWeb || isWideWeb;
  const max =
    variant === 'home'
      ? PERSONAL_HOME_WEB_MAX
      : variant === 'wide'
        ? PERSONAL_WEB_WIDE_MAX
        : variant === 'narrow'
          ? 560
          : PERSONAL_WEB_COLUMN_MAX;
  const padH = wide ? layout.pagePadding.desktop : shell.pagePaddingH;
  const topPad = wide ? spacing[20] : spacing[16];
  return {
    width: '100%',
    maxWidth: wide ? max : '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingLeft: padH,
    paddingRight: padH,
    paddingTop: `calc(${topPad}px + env(safe-area-inset-top, 0px))`,
    paddingBottom: native
      ? `calc(${spacing[28]}px + env(safe-area-inset-bottom, 0px))`
      : `calc(${spacing[28]}px + env(safe-area-inset-bottom, 0px))`,
    boxSizing: 'border-box',
  };
}

/** Desktop / wide web: subtle vertical wash behind the column (SaaS “app on canvas” feel). */
export function personalCanvasRootStyle(isDesktopWeb, isWideWeb = false) {
  const wide = isDesktopWeb || isWideWeb;
  if (!wide) {
    return {
      minHeight: '100%',
      background: colors.bg,
      color: colors.text,
    };
  }
  return {
    minHeight: '100%',
    background: `linear-gradient(168deg, ${colors.bg} 0%, #0c1424 42%, ${colors.bg} 100%)`,
    color: colors.text,
  };
}

/** Mobile-first: tighter vertical rhythm; web gets extra air between sections. */
export function personalSectionGap(isDesktopWeb, isWideWeb = false) {
  return isDesktopWeb || isWideWeb ? spacing[20] : spacing[12];
}

/** Extra tail space inside `PersonalColumn` below `TopBar` (tab bar / scroll comfort). Column already applies safe-area bottom. */
export function personalColumnInnerBodyStyle() {
  return { paddingBottom: spacing[24] };
}
