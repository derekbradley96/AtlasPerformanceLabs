import React from 'react';
import { COACH_DAILY_STRIP } from '@/lib/coachDailyWorkflowModel';
import { colors, spacing, radii } from '@/ui/tokens';
import { hapticSelection } from '@/lib/haptics';
import { setNativePref } from '@/lib/nativePreferences';

const COACH_STRIP_PREF_KEY = 'atlas_pref_coach_strip_key';

/**
 * Clickable priority chips → filter coach action queue; optional second tap opens Review Center pre-filtered.
 * @param {{
 *   selectedKey: string,
 *   counts: Record<string, number>,
 *   onSelect: (key: string) => void,
 *   compact?: boolean,
 * }} props
 */
export default function CoachDailyPriorityStrip({ selectedKey, counts, onSelect, compact = false }) {
  return (
    <div
      role="tablist"
      aria-label="Today priorities"
      className={compact ? 'flex gap-2 overflow-x-auto pb-1 -mx-1 px-1' : 'flex flex-wrap gap-2'}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {COACH_DAILY_STRIP.map((chip) => {
        const n = Number(counts?.[chip.key] ?? 0) || 0;
        const active = selectedKey === chip.key;
        return (
          <button
            key={chip.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              hapticSelection();
              void setNativePref(COACH_STRIP_PREF_KEY, chip.key);
              onSelect(chip.key);
            }}
            className="shrink-0 rounded-full font-semibold transition-colors"
            style={{
              padding: compact ? `${spacing[8]}px ${spacing[12]}px` : `${spacing[10]}px ${spacing[14]}px`,
              fontSize: compact ? 12 : 13,
              border: `1px solid ${active ? colors.primary : colors.border}`,
              background: active ? 'rgba(59,130,246,0.18)' : colors.surface1,
              color: active ? colors.text : colors.muted,
              borderRadius: radii.full,
              minHeight: compact ? 36 : 40,
            }}
          >
            {chip.label}
            <span
              className="tabular-nums"
              style={{
                marginLeft: 6,
                opacity: 0.95,
                color: active ? colors.accent : colors.muted,
              }}
            >
              {n}
            </span>
          </button>
        );
      })}
    </div>
  );
}
