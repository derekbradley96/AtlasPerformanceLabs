import React from 'react';
import { colors, radii } from '@/ui/tokens';

export default function Skeleton({ width, height, style = {}, className = '' }) {
  return (
    <div
      className={`animate-pulse ${className}`}
      style={{
        width: width || '100%',
        height: height || 16,
        background: colors.surface2,
        borderRadius: radii.sm,
        ...style,
      }}
    />
  );
}
