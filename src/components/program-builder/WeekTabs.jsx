/**
 * Week selector tabs for Program Builder.
 * Clean pill tabs; later weeks show as muted when not yet created.
 */
import React from 'react';
import { colors, spacing, shell, radii } from '@/ui/tokens';
import { sectionLabel } from '@/ui/pageLayout';

export default function WeekTabs({
  weeks,
  totalWeeks,
  selectedWeekIndex,
  onSelectWeek,
}) {
  const count = Math.max(1, totalWeeks);

  return (
    <div style={{ marginBottom: spacing[16] }}>
      <p style={{ ...sectionLabel }}>Week</p>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: count }, (_, i) => i + 1).map((num) => {
          const week = weeks.find((w) => w.week_number === num);
          const isSelected = selectedWeekIndex < weeks.length && weeks[selectedWeekIndex]?.week_number === num;
          const disabled = num > 1 && !week;

          return (
            <button
              key={num}
              type="button"
              onClick={() => {
                if (disabled) return;
                const idx = weeks.findIndex((w) => w.week_number === num);
                onSelectWeek(idx >= 0 ? idx : 0);
              }}
              disabled={disabled}
              className="transition-opacity"
              style={{
                padding: `${spacing[10]}px ${spacing[16]}px`,
                borderRadius: shell.cardRadius,
                border: `1px solid ${isSelected ? colors.primary : shell.cardBorder}`,
                background: isSelected ? colors.primarySubtle : 'transparent',
                color: disabled ? colors.muted : isSelected ? colors.primary : colors.text,
                fontSize: 14,
                fontWeight: 500,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
              }}
            >
              {num}
            </button>
          );
        })}
      </div>
    </div>
  );
}
