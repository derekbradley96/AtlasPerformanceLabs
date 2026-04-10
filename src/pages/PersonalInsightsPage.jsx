import React from 'react';
import Card from '@/ui/Card';
import PersonalSurface from '@/components/personal/PersonalSurface';
import { colors, spacing, shell } from '@/ui/tokens';

export default function PersonalInsightsPage() {
  return (
    <PersonalSurface>
    <div className="min-h-screen max-w-full overflow-x-hidden" style={{ color: colors.text }}>
      <div className="max-w-xl mx-auto w-full space-y-4">
        <header>
          <h1 className="text-2xl font-semibold mb-1" style={{ color: colors.text }}>
            Personal coaching assistant
          </h1>
          <p className="text-sm" style={{ color: colors.muted }}>
            A simple overview of your recent progress, habits, and suggested adjustments.
          </p>
        </header>

        <Card
          style={{
            padding: spacing[16],
            background: colors.surface,
            borderRadius: shell.cardRadius,
          }}
        >
          <p className="text-xs mb-1 uppercase tracking-wide" style={{ color: colors.muted }}>
            Progress trends
          </p>
          <p className="text-sm mb-2" style={{ color: colors.text }}>
            Your weight has plateaued.
          </p>
          <p className="text-xs" style={{ color: colors.muted }}>
            Based on your recent check-ins, your average weight has stayed within a narrow range. If your goal is fat loss,
            consider tightening nutrition or increasing activity slightly.
          </p>
        </Card>

        <Card
          style={{
            padding: spacing[16],
            background: colors.surface,
            borderRadius: shell.cardRadius,
          }}
        >
          <p className="text-xs mb-1 uppercase tracking-wide" style={{ color: colors.muted }}>
            Habit adherence
          </p>
          <p className="text-sm mb-2" style={{ color: colors.text }}>
            Habit adherence dropped this week.
          </p>
          <p className="text-xs" style={{ color: colors.muted }}>
            You completed fewer of your planned habits over the last 7 days. Pick one or two key actions to focus on this week so
            it feels achievable.
          </p>
        </Card>

        <Card
          style={{
            padding: spacing[16],
            background: colors.surface,
            borderRadius: shell.cardRadius,
          }}
        >
          <p className="text-xs mb-1 uppercase tracking-wide" style={{ color: colors.muted }}>
            Suggested adjustments
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li className="text-sm" style={{ color: colors.text }}>
              Consider increasing activity slightly (for example, an extra walk on 2–3 days this week).
            </li>
            <li className="text-sm" style={{ color: colors.text }}>
              Choose one habit to treat as “non‑negotiable” for the next 7 days.
            </li>
            <li className="text-sm" style={{ color: colors.text }}>
              If your goal or schedule has changed, review your plan with your coach or adjust your targets.
            </li>
          </ul>
        </Card>
      </div>
    </div>
    </PersonalSurface>
  );
}

