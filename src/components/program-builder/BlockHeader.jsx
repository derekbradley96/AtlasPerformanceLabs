/**
 * Block header: block name, weeks, save. Premium card styling.
 */
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Save } from 'lucide-react';
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
  onSave,
  onEffectiveWeeksChange,
  saving,
  saveDisabled,
  hasBlock,
  blockNamePlaceholder = 'Block name',
  saveHint = '',
  /** Personal training plan: “plan” wording instead of “block”. */
  planMode = false,
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

  /** Commit weeks from the input immediately so Save/Create uses the value even if the weeks field never blurred. */
  const handleSaveClick = () => {
    if (saving) return;
    const nextWeeks = commitWeeks();
    if (typeof onSave === 'function') {
      onSave({ totalWeeks: nextWeeks });
    }
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
        <button
          type="button"
          onClick={handleSaveClick}
          disabled={saving}
          className="inline-flex items-center gap-2 shrink-0 transition-opacity"
          style={{
            padding: `${spacing[12]}px ${spacing[18]}px`,
            borderRadius: 10,
            background: colors.primary,
            color: '#fff',
            border: 'none',
            fontSize: 14,
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          <Save size={18} />{' '}
          {saving
            ? hasBlock
              ? 'Saving…'
              : 'Creating…'
            : hasBlock
              ? 'Save'
              : planMode
                ? 'Create plan'
                : 'Create block'}
        </button>
      </div>
      {!!saveHint && (
        <p className="text-xs mt-2" style={{ color: colors.muted, marginBottom: 0 }}>
          {saveHint}
        </p>
      )}
    </Card>
  );
}
