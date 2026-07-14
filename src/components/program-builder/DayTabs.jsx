/**
 * Day selector pills for Program Builder.
 * Pills + Add day only — Duplicate day lives in the ⋯ menu rendered alongside
 * this row in ProgramWeekView.
 */
import React from 'react';
import { Plus } from 'lucide-react';
import { colors, shell } from '@/ui/tokens';

const MAX_DAYS = 7;

const pillStyle = (selected) => ({
  minHeight: 36,
  padding: '0 14px',
  borderRadius: 999,
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
  addDayDisabled,
}) {
  const atMax = days.length >= MAX_DAYS;

  return (
    <div className="flex flex-wrap gap-2" style={{ flex: 1, minWidth: 0 }}>
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
  );
}
