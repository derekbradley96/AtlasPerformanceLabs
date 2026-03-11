/**
 * Premium weekly summary card: wins, slips, next actions.
 * Used in Call Prep preview and can be rendered inside SummaryCardBubble in thread.
 */
import React from 'react';
import { colors, spacing } from '@/ui/tokens';

export default function WeeklySummaryCard({ wins = [], slips = [], nextActions = [], title = 'Weekly Summary', compact }) {
  const w = Array.isArray(wins) ? wins : [];
  const s = Array.isArray(slips) ? slips : [];
  const n = Array.isArray(nextActions) ? nextActions : [];

  return (
    <div
      className="rounded-xl overflow-hidden border"
      style={{
        background: colors.card,
        borderColor: colors.border,
        padding: compact ? spacing[12] : spacing[16],
      }}
    >
      <h3 className="text-[13px] font-semibold uppercase tracking-wide mb-3" style={{ color: colors.muted }}>
        {title}
      </h3>
      <div className="space-y-4">
        {w.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: colors.muted }}>Wins</p>
            <ul className="text-[14px] space-y-0.5" style={{ color: colors.text }}>
              {w.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {s.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: colors.muted }}>Slips</p>
            <ul className="text-[14px] space-y-0.5" style={{ color: colors.text }}>
              {s.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {n.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: colors.muted }}>Next actions</p>
            <ul className="text-[14px] space-y-0.5" style={{ color: colors.text }}>
              {n.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
