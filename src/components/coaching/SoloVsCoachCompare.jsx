import React from 'react';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';

export default function SoloVsCoachCompare() {
  return (
    <Card style={{ padding: spacing[14], border: `1px solid ${colors.border}`, background: colors.surface1 }}>
      <p style={{ margin: 0, fontSize: 12, color: colors.text, fontWeight: 600, lineHeight: 1.4 }}>
        Personal helps you stay structured. Coaching helps you transform.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[12], marginTop: spacing[12] }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
            Personal (free)
          </p>
          <ul style={{ margin: `${spacing[8]}px 0 0`, paddingLeft: 16, color: colors.muted, fontSize: 13, lineHeight: 1.45 }}>
            <li>Your own structure</li>
            <li>Logging and tracking</li>
            <li>Consistency tools</li>
            <li>Trend awareness</li>
          </ul>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
            Coaching
          </p>
          <ul style={{ margin: `${spacing[8]}px 0 0`, paddingLeft: 16, color: colors.text, fontSize: 13, lineHeight: 1.45 }}>
            <li>Human decisions</li>
            <li>Accountability</li>
            <li>Precise feedback</li>
            <li>Context-specific changes</li>
            <li>Contest prep support</li>
            <li>Course correction</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
