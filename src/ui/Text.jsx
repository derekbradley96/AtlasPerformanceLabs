/**
 * Typography hierarchy – use variants instead of ad-hoc classes.
 * Variants: h1, h2, h3, body, bodySmall, muted, caption, label, mono
 */
import React from 'react';
import { colors } from './tokens';

const VARIANTS = {
  h1: { fontSize: 24, fontWeight: 700, lineHeight: 1.25 },
  h2: { fontSize: 20, fontWeight: 600, lineHeight: 1.3 },
  h3: { fontSize: 17, fontWeight: 600, lineHeight: 1.35 },
  body: { fontSize: 15, fontWeight: 400, lineHeight: 1.5 },
  bodySmall: { fontSize: 14, fontWeight: 400, lineHeight: 1.45 },
  muted: { fontSize: 13, fontWeight: 400, lineHeight: 1.4 },
  caption: { fontSize: 12, fontWeight: 400, lineHeight: 1.35 },
  label: { fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' },
  mono: { fontFamily: 'ui-monospace, monospace', fontSize: 13 },
};

export default function Text({
  variant = 'body',
  color,
  style = {},
  className = '',
  as: Component = 'span',
  ...rest
}) {
  const variantStyle = VARIANTS[variant] || VARIANTS.body;
  const resolvedColor = color ?? (variant === 'muted' || variant === 'caption' || variant === 'label' ? colors.muted : colors.text);
  return (
    <Component
      className={className}
      style={{
        ...variantStyle,
        color: resolvedColor,
        margin: 0,
        ...style,
      }}
      {...rest}
    />
  );
}
