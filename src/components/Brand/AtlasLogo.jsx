/**
 * Reusable Atlas logo with size variants. Single asset, consistent sizing.
 * - splash: largest, centered (splash screen)
 * - auth: medium (login/signup)
 * - header: 56×56 container, 36px image (in-app top bar)
 * - inline: 88px (cards, sections)
 */
import React from 'react';
import { colors } from '@/ui/tokens';
import logoImage from '@/assets/logo-image-1.png';

const VARIANT_STYLES = {
  splash: {
    wrapper: {
      width: 320,
      maxWidth: '85vw',
      height: 'auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    img: {
      width: '100%',
      height: 'auto',
      maxWidth: '100%',
    },
  },
  auth: {
    wrapper: {
      width: 200,
      maxWidth: '55vw',
      height: 'auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    img: {
      width: '100%',
      height: 'auto',
      maxWidth: '100%',
    },
  },
  header: {
    wrapper: {
      width: 56,
      height: 56,
      minWidth: 56,
      minHeight: 56,
      borderRadius: 14,
      background: colors.surface1,
      border: `1px solid ${colors.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    img: {
      width: 36,
      height: 36,
      objectFit: 'contain',
    },
  },
  inline: {
    wrapper: {
      width: 88,
      height: 'auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    img: {
      width: '100%',
      height: 'auto',
      maxWidth: '100%',
    },
  },
};

export default function AtlasLogo({
  variant = 'header',
  showWordmark = false,
  className = '',
  style = {},
  wrapperStyle = {},
  alt = 'Atlas',
}) {
  const config = VARIANT_STYLES[variant] ?? VARIANT_STYLES.header;
  const baseImgStyle = {
    objectFit: 'contain',
    display: 'block',
    backgroundColor: 'transparent',
  };

  return (
    <div
      className={className}
      style={{
        ...config.wrapper,
        maxWidth: '100%',
        ...wrapperStyle,
      }}
    >
      <img
        src={logoImage}
        alt={alt}
        style={{
          ...baseImgStyle,
          ...config.img,
          ...style,
        }}
      />
    </div>
  );
}
