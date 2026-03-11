/**
 * Block header: block name, weeks, save. Premium card styling.
 */
import React from 'react';
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

export default function BlockHeader({
  blockName,
  onBlockNameChange,
  totalWeeks,
  onTotalWeeksChange,
  onSave,
  saving,
  saveDisabled,
  hasBlock,
  blockNamePlaceholder = 'Block name',
}) {
  return (
    <Card style={{ ...standardCard, marginBottom: spacing[16], padding: spacing[16] }}>
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="text"
          placeholder={blockNamePlaceholder}
          value={blockName}
          onChange={(e) => onBlockNameChange(e.target.value)}
          style={{
            flex: 1,
            minWidth: 140,
            padding: `${spacing[12]}px ${spacing[14]}px`,
            fontSize: 15,
            ...inputBase,
          }}
          aria-label="Block name"
        />
        <input
          type="number"
          min={1}
          max={52}
          value={totalWeeks}
          onChange={(e) => onTotalWeeksChange(Number(e.target.value) || 4)}
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
        <button
          type="button"
          onClick={onSave}
          disabled={saveDisabled || saving}
          className="inline-flex items-center gap-2 shrink-0 transition-opacity"
          style={{
            padding: `${spacing[12]}px ${spacing[18]}px`,
            borderRadius: 10,
            background: colors.primary,
            color: '#fff',
            border: 'none',
            fontSize: 14,
            fontWeight: 600,
            cursor: saveDisabled || saving ? 'not-allowed' : 'pointer',
            opacity: saveDisabled || saving ? 0.7 : 1,
          }}
        >
          <Save size={18} /> {saving ? 'Saving…' : hasBlock ? 'Save' : 'Create block'}
        </button>
      </div>
    </Card>
  );
}
