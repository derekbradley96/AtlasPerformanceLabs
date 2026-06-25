/**
 * Brand logo component.
 * - splash / auth: raster logo image (mix-blend-mode: screen removes the black background
 *   on the dark navy surface, leaving only the glowing Atlas figure visible)
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

// Brightens the logo art and uses lighten blend so the dark background of the
// PNG disappears on the app's dark navy surface while the glowing figure stays vivid.
const LOGO_IMG_STYLE = {
  mixBlendMode: 'screen',
  filter: 'brightness(1.6) saturate(1.3) contrast(1.1)',
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
            width: 200,
            maxWidth: '60vw',
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
