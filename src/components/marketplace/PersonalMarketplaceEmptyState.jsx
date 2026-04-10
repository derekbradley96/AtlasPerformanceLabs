import React from 'react';
import { colors, spacing, radii, touchTargetMin, shell } from '@/ui/tokens';

/**
 * Personal discover: minimal empty states.
 */
export default function PersonalMarketplaceEmptyState({
  variant,
  onRequestConsultation,
  onGetMatched,
  onContinueSolo,
  onClearFilters,
}) {
  const isMarketEmpty = variant === 'market-empty';

  return (
    <div
      className="rounded-2xl border text-center"
      style={{
        borderColor: shell.cardBorder,
        background: colors.surface1,
        padding: spacing[24],
        maxWidth: 400,
        margin: '0 auto',
      }}
    >
      <h2 className="text-lg font-bold m-0" style={{ color: colors.text }}>
        {isMarketEmpty ? 'No coaches yet' : 'No matches'}
      </h2>
      <p className="text-sm m-0 mt-2 leading-relaxed" style={{ color: colors.muted }}>
        {isMarketEmpty
          ? 'Atlas coaching is just getting started.'
          : 'Try different filters or clear them to see everyone listed.'}
      </p>

      <div
        className="flex flex-col items-stretch gap-2.5"
        style={{ marginTop: spacing[20], maxWidth: 280, marginLeft: 'auto', marginRight: 'auto' }}
      >
        {isMarketEmpty ? (
          <>
            <button
              type="button"
              onClick={onGetMatched}
              style={{
                minHeight: touchTargetMin,
                borderRadius: radii.button,
                border: 'none',
                background: colors.primary,
                color: '#fff',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Get matched
            </button>
            <button
              type="button"
              onClick={onRequestConsultation}
              style={{
                minHeight: touchTargetMin,
                borderRadius: radii.button,
                border: `1px solid ${colors.border}`,
                background: colors.surface2,
                color: colors.text,
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Request consultation
            </button>
            <button
              type="button"
              onClick={onContinueSolo}
              style={{
                marginTop: spacing[4],
                padding: spacing[8],
                border: 'none',
                background: 'transparent',
                color: colors.muted,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Continue solo
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onClearFilters}
              style={{
                minHeight: touchTargetMin,
                borderRadius: radii.button,
                border: 'none',
                background: colors.primary,
                color: '#fff',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Clear filters
            </button>
            <button
              type="button"
              onClick={onRequestConsultation}
              style={{
                minHeight: touchTargetMin,
                borderRadius: radii.button,
                border: `1px solid ${colors.border}`,
                background: colors.surface2,
                color: colors.text,
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Request consultation
            </button>
          </>
        )}
      </div>
    </div>
  );
}
