import React from 'react';
import Skeleton from './skeleton';
import { colors, radii, spacing } from '@/ui/tokens';

export default function SkeletonCard({ lines = 3 }) {
  return (
    <div
      style={{
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: radii.card,
        padding: spacing[20],
      }}
    >
      <Skeleton height={20} width="60%" style={{ marginBottom: spacing[12] }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={14} style={{ marginBottom: i < lines - 1 ? spacing[8] : 0 }} />
      ))}
    </div>
  );
}
