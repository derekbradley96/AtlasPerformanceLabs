/**
 * Health Breakdown bottom sheet: score, risk, flags, summary.
 * Shown when user taps the Health badge. Strict/professional tone.
 */
import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { colors, spacing } from '@/ui/tokens';

const RISK_COLORS = {
  low: 'rgba(34, 197, 94, 0.2)',
  moderate: 'rgba(245, 158, 11, 0.2)',
  high: 'rgba(239, 68, 68, 0.2)',
};
const RISK_TEXT = {
  low: '#22C55E',
  moderate: '#F59E0B',
  high: '#EF4444',
};

/** @type {{ score: number; risk: 'low' | 'moderate' | 'high'; flags: string[]; summary: string } | null} */
export default function HealthBreakdownSheet({ open, onOpenChange, result }) {
  const riskColor = result ? RISK_COLORS[result.risk] ?? RISK_COLORS.low : RISK_COLORS.low;
  const riskTextColor = result ? RISK_TEXT[result.risk] ?? RISK_TEXT.low : RISK_TEXT.low;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl"
        style={{ background: colors.card, borderColor: colors.border }}
      >
        <SheetHeader>
          <SheetTitle style={{ color: colors.text }}>Health Breakdown</SheetTitle>
        </SheetHeader>
        <div className="pt-4 pb-6" style={{ paddingTop: spacing[16], paddingBottom: spacing[24] }}>
          {result ? (
            <>
              <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: spacing[16] }}>
                <span
                  className="text-2xl font-semibold tabular-nums"
                  style={{ color: colors.text }}
                >
                  {result.score}
                </span>
                <span
                  className="rounded-full px-2.5 py-1 text-xs font-medium capitalize"
                  style={{ background: riskColor, color: riskTextColor }}
                >
                  {result.risk}
                </span>
              </div>
              {result.flags && result.flags.length > 0 && (
                <div style={{ marginBottom: spacing[16] }}>
                  <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Flags</p>
                  <ul className="list-disc list-inside space-y-1 text-sm" style={{ color: colors.text }}>
                    {result.flags.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-sm leading-relaxed" style={{ color: colors.text }}>
                {result.summary}
              </p>
            </>
          ) : (
            <p className="text-sm" style={{ color: colors.muted }}>No health data available.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
