import React from 'react';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';

const BORDER = 'rgba(255,255,255,0.06)';

/**
 * Coach response textarea.
 * @param {{ value: string, onChange: (v: string) => void, placeholder?: string }} props
 */
export default function ReviewNotesBlock({ value, onChange, placeholder = 'Add your feedback...' }) {
  return (
    <Card style={{ marginBottom: spacing[16] }}>
      <p className="text-[12px] font-semibold" style={{ color: colors.muted, marginBottom: spacing[8] }}>Coach response</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-xl resize-none focus:outline-none focus:ring-1"
        style={{
          padding: spacing[12],
          background: 'rgba(255,255,255,0.06)',
          border: `1px solid ${BORDER}`,
          color: colors.text,
          fontSize: 15,
        }}
      />
    </Card>
  );
}
