/**
 * Week selector pills for Program Builder.
 * Pills only — week tools (copy week, copy previous) live in the ⋯ menu rendered
 * alongside this row in ProgramWeekView. Week rows are created for 1..totalWeeks
 * on save/load (may be empty until you add days).
 */
import React from 'react';
import { colors, shell } from '@/ui/tokens';

export default function WeekTabs({
  weeks,
  totalWeeks,
  selectedWeekIndex,
  onSelectWeek,
}) {
  const count = Math.max(1, totalWeeks);

  return (
    <div className="flex flex-wrap gap-2" style={{ flex: 1, minWidth: 0 }}>
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
              minWidth: 40,
              height: 36,
              padding: '0 14px',
              borderRadius: 999,
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
  );
}
