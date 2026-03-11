import React from 'react';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';
import { TrendIndicator } from './ReviewDiffGrid';

/**
 * Compact diff table: label, current value, delta (e.g. vs last week).
 * @param {{ rows: Array<{ label: string, curr: string|number|null, prev: string|number|null, format: (v: any) => string, delta?: number|null }> }} props
 */
export default function ReviewDiffRows({ rows }) {
  if (!rows?.length) return null;
  return (
    <Card style={{ marginBottom: spacing[16] }}>
      <p className="text-[12px] font-semibold" style={{ color: colors.muted, marginBottom: spacing[12] }}>Diff vs last week</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {rows.map(({ label, curr, prev, format, delta }) => {
          let trend = 'neutral';
          if (delta != null && delta !== 0) trend = delta > 0 ? 'up' : 'down';
          let deltaColor = colors.muted;
          let deltaText = '';
          if (delta != null && delta !== 0) {
            deltaColor = delta > 0 ? colors.success : delta < 0 ? colors.destructive : colors.warning;
            const num = typeof delta === 'number' && (label === 'Weight' || label === 'Steps') ? delta.toFixed(1) : Math.round(delta);
            deltaText = (delta > 0 ? `+${num}` : num) + (label === 'Weight' || label === 'Steps' ? '%' : '%');
          }
          return (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: spacing[8],
                paddingBottom: spacing[8],
                borderBottom: `1px solid ${colors.border}`,
              }}
            >
              <span className="text-[13px] font-medium" style={{ color: colors.muted }}>{label}</span>
              <div className="flex items-center gap-2">
                <TrendIndicator direction={trend} />
                <span className="text-[13px]" style={{ color: colors.text }}>{format(curr)}</span>
                {deltaText ? (
                  <span className="text-[12px] font-medium" style={{ color: deltaColor }}>{deltaText}</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
