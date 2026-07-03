/**
 * Brand logo component.
 * - splash / auth: raster logo image (transparent background, sits directly on dark surfaces)
 * - header / inline: clean text wordmark (no suitable compact icon asset available)
 *
 * Variants:
 *   splash  — full logo, hero size (splash screen / loading gates)
 *   auth    — full logo, medium (login, onboarding, role pickers)
 *   header  — compact text (sidebars, desktop shell)
 *   inline  — smallest text inline (marketing nav)
 */
import React from 'react';
import { colors } from '@/ui/tokens';
import logoSrc from '@/assets/logo-image-1.png';

const TEXT = colors.text;
const MUTED = colors.muted;

// The logo PNG has a transparent background — brightness lift only, no mix-blend-mode
// (the blend broke on some WebViews (iPad) and rendered a visible box).
const LOGO_IMG_STYLE = {
  filter: 'brightness(1.45) saturate(1.2)',
};

export default function AtlasLogo({
  variant = 'header',
  showWordmark = false,
  className = '',
  style = {},
  wrapperStyle = {},
  alt = 'Atlas Performance Labs',
}) {
  if (variant === 'splash') {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          ...wrapperStyle,
        }}
      >
        <img
          src={logoSrc}
          alt={alt}
          draggable={false}
          style={{
            width: 280,
            maxWidth: '80vw',
            height: 'auto',
            objectFit: 'contain',
            display: 'block',
            ...LOGO_IMG_STYLE,
            ...style,
          }}
        />
      </div>
    );
  }

  if (variant === 'auth') {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          ...wrapperStyle,
        }}
      >
        <img
          src={logoSrc}
          alt={alt}
          draggable={false}
          style={{
            width: 340,
            maxWidth: '85vw',
            height: 'auto',
            objectFit: 'contain',
            display: 'block',
            marginTop: -40,
            marginBottom: -40,
            ...LOGO_IMG_STYLE,
            ...style,
          }}
        />
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

  // header — compact sidebar / shell
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
