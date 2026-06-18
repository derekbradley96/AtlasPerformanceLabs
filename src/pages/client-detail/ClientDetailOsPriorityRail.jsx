import React from 'react';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';

/** Best next action + required queue — driven by coach priority engine output in parent. */
export default function ClientDetailOsPriorityRail({
  topPriorityItem,
  actionRequiredItems,
  sectionLabel,
  sectionTitleBottom,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[10] }}>
      {topPriorityItem ? (
        <div>
          <p style={{ ...sectionLabel, marginBottom: sectionTitleBottom }}>Best next action</p>
          <div
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
            style={{ padding: spacing[10], borderRadius: 10, border: `1px solid ${colors.primary}`, background: colors.primarySubtle }}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: colors.text, margin: 0 }}>{topPriorityItem.title}</p>
              <p className="text-xs truncate" style={{ color: colors.muted, margin: `${spacing[2]}px 0 0` }}>{topPriorityItem.body}</p>
            </div>
            <Button size="sm" variant="primary" onClick={topPriorityItem.action}>{topPriorityItem.cta}</Button>
          </div>
        </div>
      ) : null}
      {actionRequiredItems.length > 0 ? (
        <div>
          <p style={{ ...sectionLabel, marginBottom: sectionTitleBottom }}>Action required</p>
          <div className="flex flex-col gap-2">
            {actionRequiredItems.map((item) => (
              <div
                key={item.key}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                style={{ padding: spacing[10], borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface1 }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: colors.text, margin: 0 }}>{item.title}</p>
                  <p className="text-xs truncate" style={{ color: colors.muted, margin: `${spacing[2]}px 0 0` }}>{item.body}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={item.action}>{item.cta}</Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
