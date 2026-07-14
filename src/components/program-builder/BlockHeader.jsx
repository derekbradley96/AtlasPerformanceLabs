/**
 * Block header: block name + weeks. Save lives in the sticky bottom bar
 * (ProgramWeekView) so there's a single, always-reachable save action.
 */
import React, { useEffect, useLayoutEffect, useState } from 'react';
import Card from '@/ui/Card';
import { colors, spacing, shell } from '@/ui/tokens';
import { standardCard } from '@/ui/pageLayout';

const inputBase = {
  borderRadius: 10,
  background: colors.surface2,
  border: `1px solid ${shell.cardBorder}`,
  color: colors.text,
};

/** Same clamp as commit — used for parent ref (banner / sticky save) without blurring weeks. */
export function effectiveWeeksFromWeeksField(weeksInputStr) {
  const parsed = Number(weeksInputStr);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(52, Math.round(parsed))) : 4;
}

export default function BlockHeader({
  blockName,
  onBlockNameChange,
  totalWeeks,
  onTotalWeeksChange,
  onEffectiveWeeksChange,
  blockNamePlaceholder = 'Block name',
  saveHint = '',
  /** Personal Basic: hide multi-week controls (single-week focus). */
  hideWeekCount = false,
}) {
  const [weeksInput, setWeeksInput] = useState(String(totalWeeks ?? ''));

  useEffect(() => {
    setWeeksInput(String(totalWeeks ?? ''));
  }, [totalWeeks]);

  useLayoutEffect(() => {
    if (typeof onEffectiveWeeksChange === 'function') {
      onEffectiveWeeksChange(effectiveWeeksFromWeeksField(weeksInput));
    }
  }, [weeksInput, onEffectiveWeeksChange]);

  const commitWeeks = () => {
    const nextWeeks = effectiveWeeksFromWeeksField(weeksInput);
    onTotalWeeksChange(nextWeeks);
    setWeeksInput(String(nextWeeks));
    return nextWeeks;
  };

  return (
    <Card style={{ ...standardCard, marginBottom: spacing[16], padding: spacing[16] }}>
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="text"
          placeholder={blockNamePlaceholder}
          value={blockName}
          onChange={(e) => onBlockNameChange(e.target.value)}
          onInput={(e) => onBlockNameChange(e.currentTarget.value)}
          style={{
            flex: 1,
            minWidth: 140,
            padding: `${spacing[12]}px ${spacing[14]}px`,
            fontSize: 15,
            ...inputBase,
          }}
          aria-label="Block name"
        />
        {!hideWeekCount ? (
          <>
        <input
          type="number"
          min={1}
          max={52}
          value={weeksInput}
          onChange={(e) => setWeeksInput(e.target.value)}
          onBlur={commitWeeks}
          title="Total weeks"
          style={{
            width: 56,
            padding: `${spacing[12]}px ${spacing[10]}px`,
            fontSize: 14,
            textAlign: 'center',
            ...inputBase,
          }}
          aria-label="Total weeks"
        />
        <span className="text-sm shrink-0" style={{ color: colors.muted }}>weeks</span>
          </>
        ) : null}
      </div>
      {!!saveHint && (
        <p className="text-xs mt-2" style={{ color: colors.muted, marginBottom: 0 }}>
          {saveHint}
        </p>
      )}
    </Card>
  );
}
