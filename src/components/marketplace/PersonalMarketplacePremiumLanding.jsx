import React from 'react';
import Card from '@/ui/Card';
import { colors, spacing, radii, touchTargetMin, shell } from '@/ui/tokens';
import { Sparkles } from 'lucide-react';

const HEADLINE = 'Find the right coach for your goal';
const SUBTEXT =
  'The right coach changes everything, structure, accountability, results.';

/**
 * Personal discover: minimal hero + single match block (no grids/FAQ above results).
 */
export default function PersonalMarketplacePremiumLanding({ isWideWeb, onBrowseCoaches, onGetMatched }) {
  return (
    <div style={{ marginBottom: spacing[20] }}>
      <Card
        style={{
          marginBottom: spacing[16],
          padding: isWideWeb ? spacing[24] : spacing[16],
          border: `1px solid rgba(255,255,255,0.12)`,
          background: `linear-gradient(165deg, ${colors.surface1} 0%, rgba(37, 99, 235, 0.06) 100%)`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: isWideWeb ? 30 : 22,
            fontWeight: 800,
            color: colors.text,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
          }}
        >
          {HEADLINE}
        </h1>
        <p
          style={{
            margin: `${spacing[10]}px 0 0`,
            fontSize: 15,
            color: colors.muted,
            lineHeight: 1.5,
            maxWidth: 520,
          }}
        >
          {SUBTEXT}
        </p>
        <div
          style={{
            display: 'flex',
            flexDirection: isWideWeb ? 'row' : 'column',
            gap: spacing[10],
            marginTop: spacing[18],
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={onBrowseCoaches}
            style={{
              minHeight: touchTargetMin + 2,
              padding: '0 20px',
              borderRadius: radii.button,
              border: 'none',
              background: colors.primary,
              color: '#fff',
              fontWeight: 700,
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            Browse coaches
          </button>
          <button
            type="button"
            onClick={onGetMatched}
            style={{
              minHeight: touchTargetMin + 2,
              padding: '0 18px',
              borderRadius: radii.button,
              border: `1px solid ${shell.cardBorder}`,
              background: colors.surface2,
              color: colors.text,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Get matched
          </button>
        </div>
      </Card>

      <Card
        style={{
          padding: isWideWeb ? spacing[18] : spacing[16],
          border: `1px solid rgba(37, 99, 235, 0.22)`,
          background: colors.primarySubtle,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing[12] }}>
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: radii.button,
              background: 'rgba(37, 99, 235, 0.14)',
              color: colors.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            aria-hidden
          >
            <Sparkles size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[15px] font-bold" style={{ color: colors.text }}>
              Not sure who to choose?
            </p>
            <p className="m-0 mt-1.5 text-sm leading-relaxed" style={{ color: colors.muted }}>
              Tell us your goal and we&apos;ll match you with the right coach.
            </p>
            <button
              type="button"
              onClick={onGetMatched}
              className="mt-3 font-bold text-sm"
              style={{
                minHeight: touchTargetMin,
                padding: '0 16px',
                borderRadius: radii.button,
                border: 'none',
                background: colors.primary,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Get matched
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
