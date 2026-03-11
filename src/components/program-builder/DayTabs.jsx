/**
 * Day selector tabs for Program Builder.
 * Clean day pills + Add day + Duplicate day (when a day is selected).
 */
import React from 'react';
import { Plus, Copy } from 'lucide-react';
import { colors, spacing, shell } from '@/ui/tokens';
import { sectionLabel } from '@/ui/pageLayout';

const MAX_DAYS = 7;

const pillStyle = (selected) => ({
  padding: `${spacing[10]}px ${spacing[16]}px`,
  borderRadius: shell.cardRadius,
  border: `1px solid ${selected ? colors.primary : shell.cardBorder}`,
  background: selected ? colors.primarySubtle : 'transparent',
  color: selected ? colors.primary : colors.text,
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
});

export default function DayTabs({
  days,
  selectedDayIndex,
  onSelectDay,
  onAddDay,
  onDuplicateDay,
  addDayDisabled,
}) {
  const atMax = days.length >= MAX_DAYS;
  const hasSelection = selectedDayIndex >= 0 && selectedDayIndex < days.length;

  return (
    <div style={{ marginBottom: spacing[16] }}>
      <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: spacing[10] }}>
        <p style={{ ...sectionLabel, marginBottom: 0 }}>Day</p>
        {hasSelection && onDuplicateDay && (
          <button
            type="button"
            onClick={onDuplicateDay}
            disabled={addDayDisabled || atMax}
            className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity"
            style={{
              padding: `${spacing[6]}px ${spacing[10]}px`,
              borderRadius: shell.cardRadius,
              border: `1px solid ${colors.primary}`,
              background: 'transparent',
              color: colors.primary,
              cursor: addDayDisabled || atMax ? 'not-allowed' : 'pointer',
              opacity: addDayDisabled || atMax ? 0.6 : 1,
            }}
          >
            <Copy size={14} /> Duplicate day
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {days.map((day, idx) => (
          <button
            key={day.id}
            type="button"
            onClick={() => onSelectDay(idx)}
            style={pillStyle(idx === selectedDayIndex)}
          >
            {day.title || `Day ${day.day_number}`}
          </button>
        ))}
        <button
          type="button"
          onClick={onAddDay}
          disabled={addDayDisabled || atMax}
          className="inline-flex items-center gap-1.5 transition-opacity"
          style={{
            ...pillStyle(false),
            borderStyle: 'dashed',
            color: colors.muted,
            cursor: atMax ? 'not-allowed' : 'pointer',
            opacity: atMax ? 0.6 : 1,
          }}
        >
          <Plus size={16} /> Add day
        </button>
      </div>
    </div>
  );
}
