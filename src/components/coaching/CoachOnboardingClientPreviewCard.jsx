import React, { useState } from 'react';
import { coachInitials } from '@/lib/marketplaceCoachCardModel';
import { colors, radii, shadows, spacing } from '@/ui/tokens';

/**
 * Simplified “marketplace-style” coach tile for onboarding — how clients will see you.
 *
 * @param {{
 *   displayName: string,
 *   coachTypeLabel: string,
 *   tagline?: string,
 *   taglinePlaceholder?: string,
 *   avatarUrl?: string | null,
 *   showNewCoachBadge?: boolean,
 * }} props
 */
export default function CoachOnboardingClientPreviewCard({
  displayName,
  coachTypeLabel,
  tagline,
  taglinePlaceholder = 'Add a short tagline later in your marketplace listing',
  avatarUrl,
  showNewCoachBadge = false,
}) {
  const [imgBroken, setImgBroken] = useState(false);
  const name = (displayName || '').trim() || 'Your display name';
  const initials = coachInitials(name);
  const trimmedTag = (tagline || '').trim();
  const showImg = Boolean(avatarUrl && !imgBroken);

  return (
    <div
      style={{
        borderRadius: radii.lg ?? 16,
        border: '1px solid rgba(255,255,255,0.12)',
        background: `linear-gradient(165deg, rgba(59,130,246,0.08) 0%, ${colors.surface1} 50%)`,
        boxShadow: shadows.cardShadow ?? '0 4px 24px rgba(0,0,0,0.16)',
        padding: spacing[18] ?? spacing[16],
      }}
    >
      <div className="flex gap-4 items-start">
        <div
          className="shrink-0 flex items-center justify-center overflow-hidden"
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: colors.surface2,
            border: `1px solid ${colors.border}`,
          }}
        >
          {showImg ? (
            <img
              src={avatarUrl}
              alt=""
              className="w-full h-full object-cover"
              onError={() => setImgBroken(true)}
            />
          ) : (
            <span className="text-[15px] font-bold tracking-tight" style={{ color: colors.text }}>
              {initials}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold leading-snug truncate" style={{ color: colors.text }}>
            {name}
          </p>
          <span
            className="inline-block mt-2 text-[11px] font-bold uppercase tracking-wide"
            style={{
              padding: '4px 10px',
              borderRadius: radii.pill,
              background: colors.primarySubtle,
              color: colors.accent,
              border: `1px solid rgba(59,130,246,0.25)`,
            }}
          >
            {coachTypeLabel || 'Coach'}
          </span>
          <p
            className="text-[14px] mt-3 leading-relaxed"
            style={{
              color: trimmedTag ? colors.textSecondary : colors.muted,
              fontStyle: trimmedTag ? 'normal' : 'italic',
            }}
          >
            {trimmedTag || taglinePlaceholder}
          </p>
          {showNewCoachBadge ? (
            <p className="text-[13px] mt-3 font-medium" style={{ color: colors.muted }}>
              <span aria-hidden>⭐</span> New coach
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
