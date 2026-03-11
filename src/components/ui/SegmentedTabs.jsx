import React from 'react';
import { colors, radii, touchTargetMin } from '@/ui/tokens';

export default function SegmentedTabs({ options, value, onChange, className = '' }) {
  return (
    <div
      className={`flex gap-0.5 p-1 rounded-xl ${className}`}
      style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}` }}
    >
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className="flex-1 flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200"
            style={{
              minHeight: touchTargetMin,
              background: active ? colors.surface1 : 'transparent',
              color: active ? colors.text : colors.muted,
              border: active ? `1px solid ${colors.border}` : '1px solid transparent',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.15)' : 'none',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
