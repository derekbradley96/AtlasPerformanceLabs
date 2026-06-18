import React from 'react';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';

/** Secondary intelligence queue in the OS right rail. */
export default function ClientDetailOsCoachingSignals({ intelligenceItems, sectionLabel }) {
  return (
    <div>
      <p style={{ ...sectionLabel, marginBottom: spacing[8] }}>Coaching signals</p>
      {intelligenceItems.length > 0 ? (
        <div className="flex flex-col gap-2">
          {intelligenceItems.map((item) => (
            <div key={item.key} style={{ padding: spacing[10], borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface2 }}>
              <p className="text-sm font-semibold" style={{ color: colors.text, margin: 0 }}>{item.title}</p>
              <p className="text-xs" style={{ color: colors.muted, margin: `${spacing[4]}px 0 0` }}>{item.body}</p>
              {!!item.suggestedAction && (
                <p className="text-xs font-medium" style={{ color: colors.primary, margin: `${spacing[6]}px 0 0` }}>{item.suggestedAction}</p>
              )}
              <Button size="sm" variant="secondary" style={{ marginTop: spacing[8] }} onClick={item.action}>{item.cta}</Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs m-0" style={{ color: colors.muted }}>More signals appear after check-ins land.</p>
      )}
    </div>
  );
}
