import React from 'react';
import { Info } from 'lucide-react';
import Card from '@/ui/Card';
import { colors, spacing, shell } from '@/ui/tokens';

/** Compact inline nudge — not a full Coach Bridge Card */
export default function EscalationCallout({ text = 'Solo guidance has limits here.' }) {
  return (
    <Card
      style={{
        padding: `${spacing[10]}px ${spacing[12]}px`,
        border: `1px solid ${shell.cardBorder}`,
        background: colors.surface2,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing[8] }}>
        <Info size={15} style={{ color: colors.primary, flexShrink: 0, marginTop: 1 }} aria-hidden />
        <p style={{ margin: 0, fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>{text}</p>
      </div>
    </Card>
  );
}
