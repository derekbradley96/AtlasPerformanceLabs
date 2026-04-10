/**
 * Brand mark — typography only (no raster logo asset).
 * Variants mirror the old layout so screens don’t need reflow.
 * - splash: large hero (splash / gates)
 * - auth: login / role pickers
 * - header: compact single-line (sidebars, legacy headers)
 * - inline: marketing nav / compact horizontal
 */
import React from 'react';
import { colors } from '@/ui/tokens';

const TEXT = colors.text;
const MUTED = colors.muted;

export default function AtlasLogo({
  variant = 'header',
  showWordmark = false,
  className = '',
  style = {},
  wrapperStyle = {},
  alt: _alt = 'Atlas',
}) {
  if (variant === 'splash') {
    return (
      <div
        className={className}
        style={{
          width: 320,
          maxWidth: '85vw',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          ...wrapperStyle,
        }}
      >
        <span
          style={{
            fontSize: 'clamp(1.75rem, 5vw, 2.25rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: TEXT,
            lineHeight: 1.1,
            ...style,
          }}
        >
          Atlas Performance Labs
        </span>
        {showWordmark ? (
          <span
            style={{
              marginTop: 10,
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: MUTED,
            }}
          >
            Coaching platform
          </span>
        ) : null}
      </div>
    );
  }

  if (variant === 'auth') {
    return (
      <div
        className={className}
        style={{
          width: 260,
          maxWidth: '72vw',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          ...wrapperStyle,
        }}
      >
        <span
          style={{
            fontSize: 'clamp(1.375rem, 4vw, 1.75rem)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: TEXT,
            lineHeight: 1.15,
            ...style,
          }}
        >
          Atlas Performance Labs
        </span>
        {showWordmark ? (
          <span
            style={{
              marginTop: 8,
              fontSize: '0.65rem',
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: MUTED,
            }}
          >
            Performance Labs
          </span>
        ) : null}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          gap: '0.35rem 0.5rem',
          minHeight: 32,
          ...wrapperStyle,
        }}
      >
        <span
          style={{
            fontSize: '1.125rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: TEXT,
            ...style,
          }}
        >
          Atlas
        </span>
        <span
          className="hidden sm:inline text-[11px] font-semibold tracking-[0.18em] uppercase"
          style={{ color: MUTED }}
        >
          Performance Labs
        </span>
      </div>
    );
  }

  // header — compact, no boxed tile (replaces 64×64 + image)
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        minHeight: 44,
        paddingRight: 4,
        ...wrapperStyle,
      }}
    >
      <span
        style={{
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: TEXT,
          lineHeight: 1,
          ...style,
        }}
      >
        Atlas
      </span>
    </div>
  );
}
