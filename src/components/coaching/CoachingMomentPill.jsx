import React from 'react';
import { colors } from '@/ui/tokens';

export default function CoachingMomentPill({ label }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: 999,
        background: colors.primarySubtle,
        color: colors.primary,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}
