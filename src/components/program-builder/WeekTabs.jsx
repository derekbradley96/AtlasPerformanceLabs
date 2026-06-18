/**
 * Week selector tabs for Program Builder.
 * Week rows are created for 1..totalWeeks on save/load (may be empty until you add days).
 */
import React from 'react';
import { Copy } from 'lucide-react';
import { colors, spacing, shell } from '@/ui/tokens';
import { sectionLabel } from '@/ui/pageLayout';

export default function WeekTabs({
  weeks,
  totalWeeks,
  selectedWeekIndex,
  onSelectWeek,
  onCopyWeek,
  copyWeekDisabled = false,
}) {
  const count = Math.max(1, totalWeeks);
  const hasSelection = selectedWeekIndex >= 0 && selectedWeekIndex < weeks.length;
  const selectedWeekNumber = hasSelection ? weeks[selectedWeekIndex]?.week_number : null;

  return (
    <div style={{ marginBottom: spacing[16] }}>
      <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: spacing[10] }}>
        <p style={{ ...sectionLabel, marginBottom: 0 }}>Week</p>
        {hasSelection && onCopyWeek ? (
          <button
            type="button"
            onClick={onCopyWeek}
            disabled={copyWeekDisabled}
            className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity"
            style={{
              padding: `${spacing[6]}px ${spacing[10]}px`,
              borderRadius: shell.cardRadius,
              border: `1px solid ${colors.primary}`,
              background: 'transparent',
              color: colors.primary,
              cursor: copyWeekDisabled ? 'not-allowed' : 'pointer',
              opacity: copyWeekDisabled ? 0.6 : 1,
            }}
            title={selectedWeekNumber ? `Copy Week ${selectedWeekNumber} to a new week` : 'Copy week'}
          >
            <Copy size={14} /> Copy week
          </button>
        ) : null}
      </div>
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
