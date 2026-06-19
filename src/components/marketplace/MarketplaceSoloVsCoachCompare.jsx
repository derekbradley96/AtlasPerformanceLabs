import React from 'react';
import Card from '@/ui/Card';
import { colors, shell } from '@/ui/tokens';
import { space, cardRhythm, typeStack } from '@/ui/rhythm';

/**
 * Marketplace comparison: Personal (solo) vs Coaching — ladder clarity for Personal → Coach conversion.
 */
export default function MarketplaceSoloVsCoachCompare({ isWideWeb = false }) {
  const gridCols = isWideWeb ? '1fr 1fr' : '1fr';
  const pad = cardRhythm.standard.padding;
  const innerPad = space[3];
  return (
    <Card
      style={{
        padding: pad,
        border: `1px solid rgba(255,255,255,0.12)`,
        background: colors.surface1,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 12,
          fontWeight: 700,
          color: colors.muted,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        Personal vs coaching
      </p>
      <p
        style={{
          margin: `${typeStack.headingToBody}px 0 0`,
          fontSize: 13,
          color: colors.text,
          lineHeight: 1.5,
        }}
      >
        Personal gives you structure inside Atlas for free. Coaching adds a human who steers decisions, accountability, and feedback on top of the same account.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: gridCols,
          gap: cardRhythm.standard.bodyStack,
          marginTop: space[4],
        }}
      >
        <div
          style={{
            padding: innerPad,
            borderRadius: 12,
            border: `1px solid ${shell.cardBorder}`,
            background: colors.surface2,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: colors.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 700,
            }}
          >
            Personal (free)
          </p>
          <ul
            style={{
              margin: `${space[3]}px 0 0`,
              paddingLeft: 18,
              color: colors.muted,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <li>Your own structure</li>
            <li>Solo logging</li>
            <li>Trend awareness</li>
            <li>Check-ins and habits</li>
          </ul>
        </div>
        <div
          style={{
            padding: innerPad,
            borderRadius: 12,
            border: `1px solid rgba(37, 99, 235, 0.25)`,
            background: 'rgba(37, 99, 235, 0.06)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: colors.primary,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 700,
            }}
          >
            Coaching
          </p>
          <ul
            style={{
              margin: `${space[3]}px 0 0`,
              paddingLeft: 18,
              color: colors.text,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <li>Hands-on decisions</li>
            <li>Accountability</li>
            <li>Weekly correction</li>
            <li>Personalised feedback</li>
            <li>Contest precision</li>
            <li>Human oversight</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
