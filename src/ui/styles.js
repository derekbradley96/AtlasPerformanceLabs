/**
 * Design system style helpers – avoid random inline styles.
 */
import { colors, spacing, radii } from './tokens';

export function screenContainerStyle(opts) {
  const o = opts || {};
  const paddingHorizontal = o.paddingHorizontal !== undefined ? o.paddingHorizontal : spacing[16];
  const paddingTop = o.paddingTop !== undefined ? o.paddingTop : spacing[12];
  const background = o.background !== undefined ? o.background : colors.bg;
  return {
    minHeight: '100%',
    background,
    paddingLeft: paddingHorizontal,
    paddingRight: paddingHorizontal,
    paddingTop,
    paddingBottom: o.paddingBottom,
  };
}

export function cardStyle(opts) {
  const variant = (opts && opts.variant) || 'default';
  const base = {
    background: colors.card,
    border: '1px solid ' + colors.border,
    borderRadius: radii.card,
    padding: spacing[20],
    overflow: 'hidden',
  };
  if (variant === 'subtle') {
    return { ...base, background: colors.surface1 };
  }
  return base;
}

export function sectionTitleStyle() {
  return {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: spacing[8],
  };
}

export function hairlineBorder(vertical) {
  return vertical
    ? { width: 1, alignSelf: 'stretch', background: colors.border }
    : { height: 1, width: '100%', background: colors.border };
}

export function glassPillStyle(opts) {
  const active = opts && opts.active;
  return {
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[12],
    borderRadius: radii.pill,
    background: active ? colors.primarySubtle : 'rgba(255,255,255,0.06)',
    border: '1px solid ' + (active ? colors.primary : colors.border),
    color: active ? colors.primary : colors.muted,
    fontSize: 14,
    fontWeight: 500,
  };
}

export function iconButtonStyle(opts) {
  const active = opts && opts.active;
  return {
    minWidth: 44,
    minHeight: 44,
    padding: spacing[8],
    borderRadius: radii.sm,
    background: 'transparent',
    border: 'none',
    color: active ? colors.primary : colors.muted,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}
