import React from 'react';
import { colors } from '@/ui/tokens';

const HEIGHTS = { sm: 12, md: 16, lg: 24 };
const WIDTHS = { sm: 3, md: 4, lg: 6 };
const GAPS = { sm: 2, md: 3, lg: 4 };

function clampPillars(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, n));
}

export default function PillarRating({
  pillars,
  size = 'md',
  showNumber = false,
  showCount = false,
  reviewCount = 0,
}) {
  const key = HEIGHTS[size] ? size : 'md';
  const h = HEIGHTS[key];
  const w = WIDTHS[key];
  const g = GAPS[key];
  const safePillars = clampPillars(pillars);
  const safeCount = Number(reviewCount) || 0;
  const hasRealRating =
    safeCount > 0
    && pillars != null
    && Number.isFinite(Number(pillars))
    && Number(pillars) > 0;

  if (!hasRealRating) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 8px',
          borderRadius: 20,
          background: colors.surface2,
          border: `0.5px solid ${colors.border}`,
          fontSize: 11,
          fontWeight: 500,
          color: colors.muted,
          letterSpacing: '0.02em',
        }}
      >
        New coach
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <svg width={(w + g) * 5 - g} height={h} aria-label={`${safePillars.toFixed(1)} Pillars`}>
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = Math.min(1, Math.max(0, safePillars - (i - 1)));
          return (
            <g key={i} transform={`translate(${(i - 1) * (w + g)}, 0)`}>
              <rect width={w} height={h} rx={2} fill={colors.border} />
              {fill > 0 && (
                <rect
                  y={h * (1 - fill)}
                  width={w}
                  height={h * fill}
                  rx={2}
                  fill={colors.primary}
                />
              )}
            </g>
          );
        })}
      </svg>
      {showNumber && safePillars > 0 && (
        <span style={{ fontSize: key === 'lg' ? 16 : 13, fontWeight: 600, color: colors.text }}>
          {safePillars.toFixed(1)} Pillars
        </span>
      )}
      {showCount && (
        <span style={{ fontSize: 12, color: colors.muted }}>
          {showNumber && safePillars > 0 ? '· ' : ''}
          {safeCount === 0 ? 'No ratings yet' : safeCount === 1 ? '1 Pillar rating' : `${safeCount} Pillar ratings`}
        </span>
      )}
    </div>
  );
}
