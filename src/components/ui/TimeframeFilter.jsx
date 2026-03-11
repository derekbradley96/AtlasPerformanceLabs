/**
 * Compact timeframe filter: 2w, 4w, 8w, all. Atlas segmented control styling.
 * value/onChange use keys: '2w' | '4w' | '8w' | 'all'.
 */
import React from 'react';
import { colors, touchTargetMin } from '@/ui/tokens';

export const TIMEFRAME_OPTIONS = [
  { key: '2w', label: '2w' },
  { key: '4w', label: '4w' },
  { key: '8w', label: '8w' },
  { key: 'all', label: 'All' },
];

export const DEFAULT_TIMEFRAME = '4w';

/**
 * @param {'2w' | '4w' | '8w' | 'all'} rangeKey
 * @returns {Date | null} Cutoff date (inclusive) or null for all time
 */
export function getCutoffDateForRange(rangeKey) {
  if (rangeKey === 'all') return null;
  const weeks = { '2w': 2, '4w': 4, '8w': 8 }[rangeKey] ?? 4;
  const d = new Date();
  d.setDate(d.getDate() - weeks * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Filter trend rows (with submitted_at) to those within the range.
 * @param {Array<{ submitted_at?: string | null }>} rows
 * @param {'2w' | '4w' | '8w' | 'all'} rangeKey
 * @returns {Array<{ submitted_at?: string | null }>}
 */
export function filterTrendsByRange(rows, rangeKey) {
  const cutoff = getCutoffDateForRange(rangeKey);
  if (!cutoff) return rows ?? [];
  const iso = cutoff.toISOString();
  return (rows ?? []).filter((r) => r.submitted_at && r.submitted_at >= iso);
}

export default function TimeframeFilter({ value, onChange, className = '' }) {
  return (
    <div
      className={`flex gap-0.5 p-1 rounded-xl ${className}`}
      style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}` }}
    >
      {TIMEFRAME_OPTIONS.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className="flex-1 flex items-center justify-center rounded-lg text-xs font-medium transition-all duration-200"
            style={{
              minHeight: Math.max(32, touchTargetMin - 8),
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
