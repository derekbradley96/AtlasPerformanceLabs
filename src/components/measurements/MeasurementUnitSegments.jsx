import React from 'react';
import { colors, radii, spacing, touchTargetMin } from '@/ui/tokens';

/**
 * @param {{
 *   label: string,
 *   options: ReadonlyArray<{ id: string, label: string }>,
 *   value: string,
 *   onChange: (id: string) => void,
 *   disabled?: boolean,
 * }} props
 */
export default function MeasurementUnitSegments({ label, options, value, onChange, disabled }) {
  return (
    <div style={{ marginBottom: spacing[14] }}>
      <p style={{ margin: `0 0 ${spacing[8]}px`, fontSize: 11, fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </p>
      <div className="flex flex-wrap" style={{ gap: spacing[8] }}>
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.id)}
              style={{
                minHeight: touchTargetMin - 2,
                padding: `${spacing[8]}px ${spacing[14]}px`,
                borderRadius: radii.button,
                border: active ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                background: active ? colors.primarySubtle : colors.surface2,
                color: colors.text,
                fontSize: 13,
                fontWeight: 700,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const HEIGHT_SEGMENT_OPTIONS = [
  { id: 'cm', label: 'CM' },
  { id: 'ft_in', label: 'FT / IN' },
  { id: 'm', label: 'M' },
];

/** Body metrics (bodyweight / targets) — not bar load */
export const BODYWEIGHT_SEGMENT_OPTIONS = [
  { id: 'kg', label: 'KG' },
  { id: 'st_lb', label: 'ST / LB' },
  { id: 'lb', label: 'LB' },
];

/** @deprecated use BODYWEIGHT_SEGMENT_OPTIONS */
export const WEIGHT_SEGMENT_OPTIONS = BODYWEIGHT_SEGMENT_OPTIONS;

/** Training load only — kg or lb, never stones */
export const LOAD_SEGMENT_OPTIONS = [
  { id: 'kg', label: 'KG' },
  { id: 'lb', label: 'LB' },
];
