import React from 'react';
import Card from '@/ui/Card';
import { colors, spacing, radii, touchTargetMin } from '@/ui/tokens';

export default function ClientTabShell({ tabs, activeTab, onChange }) {
  return (
    <Card style={{ marginBottom: spacing[16], padding: spacing[8], overflowX: 'auto' }}>
      <div className="flex gap-2" style={{ minWidth: 'max-content' }}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              style={{
                minHeight: touchTargetMin,
                padding: `0 ${spacing[12]}px`,
                borderRadius: radii.button,
                border: active ? `1px solid ${colors.primary}` : `1px solid ${colors.border}`,
                background: active ? colors.primarySubtle : colors.surface1,
                color: active ? colors.primary : colors.text,
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
