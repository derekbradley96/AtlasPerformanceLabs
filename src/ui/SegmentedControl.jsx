import React from 'react';
import { colors, radii, spacing, touchTargetMin } from './tokens';

/**
 * iOS-style segmented control. options: [{ key, label }]. value = current key, onChange(key).
 */
export default function SegmentedControl({ options, value, onChange, className = '' }) {
  return (
    <div
      className={`flex gap-1 p-1 rounded-xl ${className}`}
      style={{ background: 'rgba(255,255,255,0.06)' }}
    >
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className="flex-1 flex items-center justify-center rounded-lg text-sm font-medium transition-colors"
            style={{
              minHeight: touchTargetMin,
              background: active ? colors.card : 'transparent',
              color: active ? '#F8FAFC' : colors.muted,
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
