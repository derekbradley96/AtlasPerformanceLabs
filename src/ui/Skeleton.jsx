import React from 'react';
import { colors, radii, spacing, rowHeight } from './tokens';

function SkeletonBox({ width, height, style = {} }) {
  return (
    <div
      className="animate-pulse rounded"
      style={{
        width: width ?? '100%',
        height: height ?? 16,
        background: 'rgba(255,255,255,0.08)',
        ...style,
      }}
    />
  );
}

/**
 * Card-shaped skeleton (title + 3 lines).
 */
export function SkeletonCard() {
  return (
    <div
      style={{
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: radii.lg,
        padding: spacing[16],
      }}
    >
      <SkeletonBox width="40%" height={14} style={{ marginBottom: spacing[12] }} />
      <SkeletonBox style={{ marginBottom: 8 }} />
      <SkeletonBox style={{ marginBottom: 8 }} />
      <SkeletonBox width="70%" />
    </div>
  );
}

/**
 * Row-shaped skeleton (avatar + 2 lines). Repeat for list.
 */
export function SkeletonRow() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing[12],
        minHeight: rowHeight,
        paddingLeft: spacing[16],
        paddingRight: spacing[16],
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <SkeletonBox width={44} height={44} style={{ borderRadius: 22, flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <SkeletonBox width="60%" height={14} style={{ marginBottom: 6 }} />
        <SkeletonBox width="40%" height={12} />
      </div>
    </div>
  );
}

/**
 * Inbox card row skeleton: 82px height, avatar 44, title/subtitle, CTA block.
 */
export function SkeletonInboxCard() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing[12],
        minHeight: 82,
        padding: spacing[14],
        paddingLeft: spacing[16],
        paddingRight: spacing[16],
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: radii.lg,
      }}
    >
      <SkeletonBox width={44} height={44} style={{ borderRadius: 22, flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <SkeletonBox width="55%" height={16} style={{ marginBottom: 6 }} />
        <SkeletonBox width="70%" height={14} style={{ marginBottom: 4 }} />
        <SkeletonBox width="35%" height={12} />
      </div>
      <SkeletonBox width={72} height={36} style={{ borderRadius: 8, flexShrink: 0 }} />
    </div>
  );
}

export default function Skeleton({ card, row, count = 1 }) {
  if (card) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[16] }}>
        {Array.from({ length: count }, (_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }
  if (row) {
    return (
      <div style={{ background: colors.card, borderRadius: radii.lg, overflow: 'hidden' }}>
        {Array.from({ length: count }, (_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }
  return <SkeletonCard />;
}
